<script setup lang="ts">
import type { Trip } from '~/types/api'

const props = defineProps<{
  trip: Trip
  role: 'passenger' | 'driver' | null
}>()

const api = useApi()
const toast = useToast()
const geoStore = useGeoStore()
const tripStore = useTripStore()

const startTs = computed(() => new Date(props.trip.started_at).getTime())
const now = useNow({ interval: 1000 })
const elapsed = computed(() => {
  const ms = now.value.getTime() - startTs.value
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}m ${s.toString().padStart(2, '0')}s`
})

const submitting = ref(false)
const awaitingConfirmation = computed(() =>
  tripStore.isAwaitingDropoff(props.trip.id),
)

async function requestDropoff() {
  if (submitting.value || awaitingConfirmation.value) return
  const pos = geoStore.effective
  if (!pos) {
    toast.add({
      severity: 'warn',
      summary: 'Position GPS nécessaire',
      detail: 'Active la localisation pour signaler ta sortie du véhicule.',
      life: 4000,
    })
    return
  }
  submitting.value = true
  try {
    await api(`/api/trips/${props.trip.id}/dropoff-request`, {
      method: 'POST',
      body: { lng: pos.lng, lat: pos.lat },
    })
    toast.add({
      severity: 'info',
      summary: 'Demande envoyée',
      detail: 'Le conducteur doit confirmer la fin du trajet.',
      life: 3500,
    })
  } catch (e: unknown) {
    const data = (e as { data?: { message?: string } })?.data
    toast.add({
      severity: 'error',
      summary: "Demande refusée",
      detail:
        data?.message ||
        (e as { message?: string })?.message ||
        'Impossible de signaler la sortie pour le moment.',
      life: 4500,
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="trip-sheet safe-bottom">
    <div class="row">
      <Tag :value="role === 'driver' ? 'Conducteur' : 'Passager'" />
      <span class="tr-subtle">Trajet actif · {{ elapsed }}</span>
    </div>
    <template v-if="role === 'passenger'">
      <div class="row">
        <Button
          :label="awaitingConfirmation ? 'En attente du conducteur…' : 'Je sors du véhicule'"
          :icon="awaitingConfirmation ? 'pi pi-spin pi-spinner' : 'pi pi-sign-out'"
          severity="success"
          fluid
          size="large"
          :loading="submitting"
          :disabled="awaitingConfirmation || submitting"
          @click="requestDropoff"
        />
      </div>
      <p v-if="awaitingConfirmation" class="tr-subtle await-hint">
        Préviens le conducteur à voix haute si nécessaire. Il doit valider sur son écran pour clôturer le trajet.
      </p>
    </template>
    <div v-else class="row">
      <p class="tr-subtle" style="margin: 0;">
        Termine le trajet depuis la carte (« Passager descendu »).
      </p>
    </div>
  </div>
</template>

<style scoped>
.trip-sheet {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--p-surface-0);
  border-top: 1px solid var(--p-surface-200);
}
.p-dark .trip-sheet {
  background: var(--p-surface-900);
  border-top-color: var(--p-surface-700);
}
.row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
}
.await-hint {
  margin: 0;
  font-size: 0.78rem;
  text-align: center;
}
</style>
