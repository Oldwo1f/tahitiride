<script setup lang="ts">
import type { Trip } from '~/types/api'

definePageMeta({
  layout: 'fullscreen',
  middleware: ['auth'],
})

const route = useRoute()
const api = useApi()
const socket = useSocket()
const auth = useAuth()
const geoStore = useGeoStore()
const tripStore = useTripStore()
useLiveGeolocation()

const trip = ref<Trip | null>(null)
const loading = ref(true)
const errorMsg = ref<string | null>(null)
const tripId = computed(() => String(route.params.id))

const role = computed<'passenger' | 'driver' | null>(() => {
  if (!trip.value || !auth.user) return null
  if (trip.value.passenger_id === auth.user.id) return 'passenger'
  if (trip.value.driver_id === auth.user.id) return 'driver'
  return null
})

const isActive = computed(() => trip.value?.status === 'active')

async function load() {
  loading.value = true
  errorMsg.value = null
  try {
    trip.value = await api<Trip>(`/api/trips/${tripId.value}`)
  } catch (e: unknown) {
    errorMsg.value =
      (e as { data?: { message?: string } })?.data?.message ||
      (e as { message?: string })?.message ||
      'Trajet introuvable'
  } finally {
    loading.value = false
  }
}

watch(
  () => tripStore.lastCompleted,
  (ev) => {
    if (ev && ev.trip_id === tripId.value) {
      load()
    }
  },
)

watch(
  [() => geoStore.effective, () => isActive.value],
  ([fix, active]) => {
    if (fix && active) {
      socket.emit('passenger:position', {
        lng: fix.lng,
        lat: fix.lat,
      })
    }
  },
)

onMounted(load)
</script>

<template>
  <div class="trip-page">
    <TopBar
      :title="isActive ? 'Trajet en cours' : 'Récapitulatif'"
      back-to="/map"
    />
    <div v-if="loading" class="tr-center" style="flex: 1">
      <ProgressSpinner />
    </div>
    <div v-else-if="errorMsg" class="tr-stack">
      <Message severity="error">{{ errorMsg }}</Message>
      <Button label="Retour" @click="navigateTo('/map')" />
    </div>
    <div v-else-if="trip" class="tr-stack" style="flex: 1; overflow-y: auto;">
      <Card v-if="!isActive">
        <template #title>Trajet terminé</template>
        <template #content>
          <div class="summary-grid">
            <div>
              <div class="tr-subtle">Distance</div>
              <div class="val">
                {{ trip.distance_m != null ? (trip.distance_m / 1000).toFixed(2) : '—' }} km
              </div>
            </div>
            <div>
              <div class="tr-subtle">Montant</div>
              <div class="val">{{ trip.fare_xpf ?? 0 }} XPF</div>
            </div>
            <div>
              <div class="tr-subtle">Début</div>
              <div class="val">
                {{ new Date(trip.started_at).toLocaleTimeString() }}
              </div>
            </div>
            <div>
              <div class="tr-subtle">Fin</div>
              <div class="val">
                {{ trip.ended_at ? new Date(trip.ended_at).toLocaleTimeString() : '—' }}
              </div>
            </div>
          </div>
        </template>
      </Card>

      <Card v-else>
        <template #content>
          <p>
            <i class="pi pi-clock" /> Démarré à
            {{ new Date(trip.started_at).toLocaleTimeString() }}
          </p>
          <p class="tr-subtle">
            Le trajet est en cours. Votre position est enregistrée toutes les secondes.
          </p>
        </template>
      </Card>
    </div>

    <TripActiveSheet v-if="trip && isActive" :trip="trip" :role="role" />
  </div>
</template>

<style scoped>
.trip-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem 1.5rem;
}
.summary-grid .val {
  font-size: 1.25rem;
  font-weight: 600;
}
</style>
