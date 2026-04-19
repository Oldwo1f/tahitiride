<script setup lang="ts">
import type { AdminTripDetail, AdminTripGeometry } from '~/types/admin'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const admin = useAdminApi()
const fmt = useAdminFormat()
const route = useRoute()
const toast = useToast()
const confirm = useConfirm()

const tripId = computed(() => route.params.id as string)
const trip = ref<AdminTripDetail | null>(null)
const geometry = ref<AdminTripGeometry['geometry'] | null>(null)
const loading = ref(true)
const cancelling = ref(false)
const error = ref<string | null>(null)
const cancelReason = ref('')
const cancelDialog = ref(false)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [t, g] = await Promise.all([
      admin.get<AdminTripDetail>(`/trips/${tripId.value}`),
      admin.get<AdminTripGeometry>(`/trips/${tripId.value}/points`),
    ])
    trip.value = t
    geometry.value = g.geometry
  } catch (e: unknown) {
    error.value =
      (e as { data?: { message?: string }; message?: string })?.data?.message ||
      (e as { message?: string })?.message ||
      'Chargement impossible'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openCancel() {
  cancelReason.value = ''
  cancelDialog.value = true
}

function confirmCancel() {
  if (cancelReason.value.trim().length < 3) {
    toast.add({
      severity: 'warn',
      summary: 'Indiquez un motif',
      life: 2500,
    })
    return
  }
  confirm.require({
    header: 'Confirmer l’annulation',
    message: `Le trajet sera marqué « annulé ». Aucun débit ne sera effectué. Motif : « ${cancelReason.value} »`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Annuler le trajet',
    acceptClass: 'p-button-danger',
    rejectLabel: 'Retour',
    accept: async () => {
      cancelling.value = true
      try {
        await admin.post(`/trips/${tripId.value}/cancel`, {
          reason: cancelReason.value.trim(),
        })
        toast.add({
          severity: 'success',
          summary: 'Trajet annulé',
          life: 2500,
        })
        cancelDialog.value = false
        await load()
      } catch (e: unknown) {
        toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail:
            (e as { data?: { message?: string } })?.data?.message ||
            'Annulation impossible',
          life: 4000,
        })
      } finally {
        cancelling.value = false
      }
    },
  })
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <NuxtLink to="/admin/trips" class="back-link">
        <i class="pi pi-arrow-left" /> Trajets
      </NuxtLink>
    </div>

    <Message v-if="error" severity="error" :closable="false">
      {{ error }}
    </Message>

    <div v-if="loading && !trip" class="loading">
      <ProgressSpinner />
    </div>

    <template v-else-if="trip">
      <Card>
        <template #title>Trajet {{ trip.id.slice(0, 8) }}…</template>
        <template #subtitle>
          <Tag
            :value="fmt.formatTripStatus(trip.status)"
            :severity="fmt.tripStatusSeverity(trip.status)"
          />
        </template>
        <template #content>
          <div class="trip-grid">
            <div>
              <div class="label">Démarrage</div>
              <div>{{ fmt.formatDate(trip.started_at) }}</div>
            </div>
            <div>
              <div class="label">Fin</div>
              <div>{{ fmt.formatDate(trip.ended_at) }}</div>
            </div>
            <div>
              <div class="label">Distance</div>
              <div>{{ fmt.formatDistance(trip.distance_m) }}</div>
            </div>
            <div>
              <div class="label">Tarif passager</div>
              <div>{{ fmt.formatXpf(trip.fare_xpf) }}</div>
            </div>
            <div>
              <div class="label">Part conducteur</div>
              <div>{{ fmt.formatXpf(trip.driver_share_xpf) }}</div>
            </div>
            <div>
              <div class="label">Marge plateforme</div>
              <div>{{ fmt.formatXpf(trip.platform_margin_xpf) }}</div>
            </div>
            <div>
              <div class="label">Points GPS</div>
              <div>{{ trip.points_count }}</div>
            </div>
          </div>
          <div v-if="trip.status === 'active'" class="actions">
            <Button
              label="Annuler ce trajet"
              icon="pi pi-times"
              severity="danger"
              @click="openCancel"
            />
          </div>
        </template>
      </Card>

      <Card>
        <template #title>Trajet sur carte</template>
        <template #content>
          <ClientOnly>
            <TripReplayMap :geometry="geometry" />
            <template #fallback>
              <div class="map-placeholder">
                <ProgressSpinner />
              </div>
            </template>
          </ClientOnly>
        </template>
      </Card>

      <div class="parties">
        <Card v-if="trip.passenger">
          <template #title>Passager</template>
          <template #content>
            <div class="party-name">{{ trip.passenger.full_name }}</div>
            <div class="party-email">{{ trip.passenger.email }}</div>
            <NuxtLink :to="`/admin/users/${trip.passenger.id}`" class="link">
              Profil →
            </NuxtLink>
          </template>
        </Card>
        <Card v-if="trip.driver">
          <template #title>Conducteur</template>
          <template #content>
            <div class="party-name">{{ trip.driver.full_name }}</div>
            <div class="party-email">{{ trip.driver.email }}</div>
            <NuxtLink :to="`/admin/users/${trip.driver.id}`" class="link">
              Profil →
            </NuxtLink>
          </template>
        </Card>
        <Card v-if="trip.vehicle">
          <template #title>Véhicule</template>
          <template #content>
            <div class="party-name">{{ trip.vehicle.plate }}</div>
            <div class="party-email">
              {{ trip.vehicle.model }} · {{ trip.vehicle.color }}
            </div>
          </template>
        </Card>
      </div>
    </template>

    <Dialog
      v-model:visible="cancelDialog"
      modal
      header="Annuler le trajet"
      :closable="!cancelling"
      :style="{ width: '480px' }"
    >
      <div class="dialog-body">
        <p>Indiquez le motif de l’annulation. Cette action est tracée.</p>
        <Textarea
          v-model="cancelReason"
          rows="3"
          placeholder="Litige, doublon, demande utilisateur..."
        />
      </div>
      <template #footer>
        <Button
          label="Retour"
          severity="secondary"
          text
          :disabled="cancelling"
          @click="cancelDialog = false"
        />
        <Button
          label="Annuler le trajet"
          severity="danger"
          icon="pi pi-times"
          :loading="cancelling"
          @click="confirmCancel"
        />
      </template>
    </Dialog>

    <ConfirmDialog />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.back-link {
  text-decoration: none;
  color: var(--p-text-muted-color);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.loading {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}
.trip-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
}
.label {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.2rem;
}
.actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
}
.parties {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}
.party-name {
  font-weight: 600;
}
.party-email {
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
  word-break: break-all;
}
.link {
  font-size: 0.85rem;
  margin-top: 0.5rem;
  display: inline-block;
}
.map-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 360px;
  background: var(--p-surface-100);
  border-radius: 6px;
}
.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>
