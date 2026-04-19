<script setup lang="ts">
import type { CertificationExpiringEvent, MyCertifications } from '~/types/api'

const reminders = useCertificationReminder()
const auth = useAuthStore()
const api = useApi()
const router = useRouter()

const currentIndex = ref(0)
const uploadOpen = ref(false)
const uploadVehicleId = ref<string | null>(null)

const visibleList = computed<CertificationExpiringEvent[]>(
  () => reminders.active.value,
)

const visible = computed<boolean>(() => visibleList.value.length > 0)

const current = computed<CertificationExpiringEvent | null>(() => {
  const list = visibleList.value
  if (list.length === 0) return null
  return list[Math.min(currentIndex.value, list.length - 1)] ?? null
})

watch(visibleList, (list) => {
  if (currentIndex.value >= list.length) currentIndex.value = 0
})

const dialogVisible = computed<boolean>({
  get: () => visible.value,
  // The Dialog tries to close itself; we treat that as "later".
  set: (v) => {
    if (!v && current.value) reminders.dismiss(current.value.vehicle_id)
  },
})

const dueText = computed<string>(() => {
  const c = current.value
  if (!c) return ''
  if (c.days_left == null) return ''
  if (c.days_left <= 0) return "expire aujourd'hui"
  if (c.days_left === 1) return 'expire demain'
  return `expire dans ${c.days_left} jours`
})

const dateText = computed<string>(() => {
  const c = current.value
  if (!c?.certified_until) return ''
  try {
    const d = new Date(`${c.certified_until}T00:00:00`)
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(d)
  } catch {
    return ''
  }
})

function later(): void {
  if (current.value) reminders.dismiss(current.value.vehicle_id)
}

async function renew(): Promise<void> {
  const c = current.value
  if (!c) return
  uploadVehicleId.value = c.vehicle_id
  uploadOpen.value = true
}

function viewProfile(): void {
  later()
  void router.push('/profile')
}

function onSubmitted(): void {
  if (uploadVehicleId.value) {
    reminders.forget(uploadVehicleId.value)
  }
  uploadOpen.value = false
}

// Bootstraps the local list from `/api/certifications/me` so reminders
// also fire when the user opens the app cold (the daily push cron only
// runs once a day, but the driver should still see vehicles that need
// renewal right after login).
async function refreshFromBackend(): Promise<void> {
  if (!auth.isAuthed || !auth.user) return
  if (auth.user.role === 'passenger' || auth.user.role === 'admin') return
  try {
    const me = await api<MyCertifications>('/api/certifications/me')
    for (const v of me.vehicles) {
      if (v.needs_renewal_reminder) {
        reminders.notify({
          vehicle_id: v.vehicle_id,
          plate: v.plate,
          certified_until: v.certified_until,
          days_left: v.expires_in_days,
        })
      }
    }
  } catch {
    /* ignore — non-blocking UX */
  }
}

watch(
  () => auth.isAuthed,
  (v) => {
    if (v) void refreshFromBackend()
  },
  { immediate: true },
)
</script>

<template>
  <Dialog
    v-model:visible="dialogVisible"
    :modal="true"
    header="Renouvellement de l'assurance"
    :style="{ width: '92vw', maxWidth: '420px' }"
    :draggable="false"
  >
    <div v-if="current" class="cert-reminder">
      <p class="cert-reminder-headline">
        La vignette du véhicule
        <strong>{{ current.plate }}</strong>
        {{ dueText }}.
      </p>
      <p v-if="dateText" class="tr-subtle">
        Date de fin de validité : {{ dateText }}
      </p>
      <p class="cert-reminder-info">
        Téléversez une nouvelle vignette pour rester certifié et continuer
        à transporter des passagers.
      </p>
      <div v-if="visibleList.length > 1" class="tr-subtle cert-reminder-more">
        + {{ visibleList.length - 1 }} autre(s) véhicule(s) à renouveler
      </div>
    </div>
    <template #footer>
      <Button
        label="Plus tard"
        text
        severity="secondary"
        @click="later"
      />
      <Button
        label="Voir mon profil"
        icon="pi pi-user"
        severity="secondary"
        @click="viewProfile"
      />
      <Button
        label="Renouveler"
        icon="pi pi-camera"
        @click="renew"
      />
    </template>
  </Dialog>

  <CertificationUploadDialog
    v-model:visible="uploadOpen"
    type="insurance"
    :vehicle-id="uploadVehicleId"
    :context-label="
      uploadVehicleId
        ? `Véhicule ${current?.plate ?? ''}`
        : null
    "
    @submitted="onSubmitted"
  />
</template>

<style scoped>
.cert-reminder {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.cert-reminder-headline {
  margin: 0;
  font-size: 1rem;
}
.cert-reminder-info {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  color: var(--p-text-color);
}
.cert-reminder-more {
  font-style: italic;
}
</style>
