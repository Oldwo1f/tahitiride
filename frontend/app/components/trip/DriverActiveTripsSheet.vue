<script setup lang="ts">
/**
 * Bottom sheet shown to a driver while they have at least one passenger
 * on board. Lists every active trip (one row per passenger) with a
 * dedicated "Descendu" button to settle that specific passenger's ride.
 *
 * The list is refreshed:
 *   - on mount,
 *   - whenever the trip store records a started/completed event,
 *   - whenever a dropoff request comes in (so a freshly-arrived
 *     passenger appears immediately),
 *   - on a polling interval as a safety net for missed events.
 */
import type { TripSummary } from '~/types/api'

const api = useApi()
const toast = useToast()
const confirm = useConfirm()
const geoStore = useGeoStore()
const tripStore = useTripStore()

const trips = ref<TripSummary[]>([])
const loading = ref(false)
const completing = reactive<Record<string, boolean>>({})
let pollHandle: ReturnType<typeof setInterval> | null = null

async function refresh() {
  loading.value = true
  try {
    trips.value = await api<TripSummary[]>('/api/trips/active-passengers')
  } catch {
    /* silent — UI shows empty state */
  } finally {
    loading.value = false
  }
}

async function completeTrip(trip: TripSummary) {
  if (completing[trip.id]) return
  const pos = geoStore.effective
  if (!pos) {
    toast.add({
      severity: 'warn',
      summary: 'Position GPS nécessaire',
      detail: 'Active la localisation pour finaliser le trajet.',
      life: 4000,
    })
    return
  }
  completing[trip.id] = true
  try {
    await api(`/api/trips/${trip.id}/complete`, {
      method: 'POST',
      body: { lng: pos.lng, lat: pos.lat },
    })
    tripStore.dismissPendingDropoff(trip.id)
    toast.add({
      severity: 'success',
      summary: 'Passager déposé',
      detail: trip.partner_name,
      life: 3000,
    })
    await refresh()
  } catch (e: unknown) {
    const data = (e as { data?: { message?: string } })?.data
    toast.add({
      severity: 'error',
      summary: 'Impossible de terminer',
      detail:
        data?.message ||
        (e as { message?: string })?.message ||
        'Erreur inconnue',
      life: 4500,
    })
  } finally {
    delete completing[trip.id]
  }
}

function askConfirmation(trip: TripSummary) {
  confirm.require({
    header: 'Passager descendu ?',
    message: `Confirmer la fin du trajet de ${trip.partner_name}.`,
    icon: 'pi pi-sign-out',
    acceptLabel: 'Terminer',
    rejectLabel: 'Annuler',
    acceptProps: { severity: 'success' },
    accept: () => {
      void completeTrip(trip)
    },
  })
}

function durationLabel(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'à l’instant'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return `${h}h${(m % 60).toString().padStart(2, '0')}`
}

watch(() => tripStore.lastStarted, refresh)
watch(() => tripStore.lastCompleted, refresh)
watch(() => tripStore.pendingDropoffList.length, refresh)

onMounted(() => {
  refresh()
  pollHandle = setInterval(refresh, 30_000)
})

onBeforeUnmount(() => {
  if (pollHandle) clearInterval(pollHandle)
  pollHandle = null
})

defineExpose({ refresh })
</script>

<template>
  <div v-if="trips.length > 0" class="driver-sheet safe-bottom">
    <div class="head">
      <i class="pi pi-users" />
      <strong>Passagers à bord</strong>
      <span class="tr-subtle count">({{ trips.length }})</span>
    </div>
    <ul class="list">
      <li v-for="t in trips" :key="t.id" class="row">
        <div class="info">
          <div class="name">
            {{ t.partner_name }}
            <span
              v-if="tripStore.pendingDropoffs[t.id]"
              class="pending-tag"
              title="Le passager a demandé à descendre"
            >
              <i class="pi pi-bell" /> demande à descendre
            </span>
          </div>
          <div class="tr-subtle meta">
            Embarqué {{ durationLabel(t.started_at) }}
          </div>
        </div>
        <Button
          label="Descendu"
          icon="pi pi-sign-out"
          severity="success"
          size="small"
          :loading="completing[t.id]"
          @click="askConfirmation(t)"
        />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.driver-sheet {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.7rem 0.85rem;
  background: var(--p-surface-0);
  border-top: 1px solid var(--p-surface-200);
  box-shadow: 0 -6px 18px rgba(0, 0, 0, 0.06);
  max-height: 45vh;
  overflow-y: auto;
}
.p-dark .driver-sheet {
  background: var(--p-surface-900);
  border-top-color: var(--p-surface-700);
}
.head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.95rem;
}
.head .count {
  margin-left: auto;
  font-size: 0.85rem;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.5rem;
  border-radius: 8px;
  background: var(--p-surface-50);
}
.p-dark .row {
  background: var(--p-surface-800);
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-weight: 600;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.pending-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: var(--p-amber-100, #fef3c7);
  color: var(--p-amber-800, #92400e);
}
.p-dark .pending-tag {
  background: rgba(180, 130, 0, 0.25);
  color: #fde68a;
}
.meta {
  font-size: 0.78rem;
}
</style>
