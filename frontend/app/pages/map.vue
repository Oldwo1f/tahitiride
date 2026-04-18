<script setup lang="ts">
import type { Direction, Trip, Vehicle } from '~/types/api'
import { DESTINATION_GROUPS } from '~/utils/destinations'
import { useUiModeStore, type UiMode } from '~/stores/uiMode'

definePageMeta({
  layout: 'fullscreen',
  middleware: ['auth'],
})

const auth = useAuth()
const socket = useSocket()
const api = useApi()
const toast = useToast()
const geoStore = useGeoStore()
const tripStore = useTripStore()
const driversStore = useDriversStore()
const passengersStore = usePassengersStore()
const uiModeStore = useUiModeStore()
const { suggestDirection } = useDirection()

useLiveGeolocation()

const mode = computed<UiMode>({
  get: () => uiModeStore.mode,
  set: (value) => uiModeStore.setMode(value),
})
const direction = ref<Direction>('city')
const destination = ref<string | null>(null)
const passengerWaiting = ref(false)
const driverOnline = ref(false)
const vehicles = ref<Vehicle[]>([])
const activeTrip = ref<Trip | null>(null)
const pickMode = ref(false)

async function loadVehicles() {
  if (!auth.isDriver) return
  try {
    vehicles.value = await api<Vehicle[]>('/api/vehicles/mine')
  } catch {
    /* ignore */
  }
}

async function loadActiveTrip() {
  try {
    activeTrip.value = await api<Trip | null>('/api/trips/active')
    tripStore.setFromApi(activeTrip.value, auth.user?.id ?? null)
  } catch {
    /* ignore */
  }
}

const effective = computed(() => geoStore.effective)

const suggestion = computed<Direction | null>(() => {
  if (!effective.value) return null
  return suggestDirection({
    lng: effective.value.lng,
    lat: effective.value.lat,
    heading: effective.value.heading,
  })
})

watch(suggestion, (s, prev) => {
  if (s && !prev) direction.value = s
})

watch(
  () => tripStore.activeTripId,
  (tripId) => {
    if (tripId) {
      passengerWaiting.value = false
      navigateTo(`/trip/${tripId}`)
    }
  },
)

watch(
  [effective, () => driverOnline.value, () => mode.value],
  ([fix, online, m]) => {
    if (!fix) return
    if (m !== 'driver' || !online) return
    socket.emit('driver:position', {
      lng: fix.lng,
      lat: fix.lat,
      heading: fix.heading,
      speed: fix.speed,
      direction: direction.value,
    })
  },
)

watch(
  [effective, () => passengerWaiting.value, () => mode.value],
  ([fix, waiting, m]) => {
    if (!fix) return
    if (m !== 'passenger') return
    if (!waiting && !tripStore.activeTripId) return
    socket.emit('passenger:position', {
      lng: fix.lng,
      lat: fix.lat,
    })
  },
)

function ensureDestination(): boolean {
  if (!destination.value) {
    toast.add({
      severity: 'warn',
      summary: 'Destination requise',
      detail: 'Choisissez une ville de destination.',
      life: 3000,
    })
    return false
  }
  return true
}

async function togglePassengerWait() {
  if (!effective.value) {
    toast.add({
      severity: 'warn',
      summary: 'Position indisponible',
      detail: 'Activez la localisation ou définissez-la manuellement.',
      life: 3000,
    })
    return
  }
  if (passengerWaiting.value) {
    socket.emit('passenger:cancel_wait')
    passengerWaiting.value = false
    driversStore.clear()
  } else {
    if (!ensureDestination()) return
    socket.emit('passenger:wait', {
      direction: direction.value,
      destination: destination.value,
      lng: effective.value.lng,
      lat: effective.value.lat,
    })
    passengerWaiting.value = true
    toast.add({
      severity: 'info',
      summary: 'En attente',
      detail: `Direction: ${direction.value === 'city' ? 'ville' : 'campagne'}`,
      life: 2500,
    })
  }
}

async function toggleDriverOnline() {
  if (!effective.value) {
    toast.add({
      severity: 'warn',
      summary: 'Position indisponible',
      life: 3000,
    })
    return
  }
  if (vehicles.value.length === 0) {
    toast.add({
      severity: 'warn',
      summary: 'Aucun véhicule',
      detail: 'Ajoutez un véhicule dans votre profil.',
      life: 4000,
    })
    navigateTo('/profile')
    return
  }
  if (driverOnline.value) {
    socket.emit('driver:offline')
    driverOnline.value = false
    passengersStore.clear()
  } else {
    if (!ensureDestination()) return
    socket.emit('driver:online', {
      direction: direction.value,
      destination: destination.value,
      lng: effective.value.lng,
      lat: effective.value.lat,
      heading: effective.value.heading,
      speed: effective.value.speed,
    })
    driverOnline.value = true
  }
}

watch(direction, (d) => {
  if (!effective.value) return
  if (mode.value === 'driver' && driverOnline.value) {
    socket.emit('driver:online', {
      direction: d,
      destination: destination.value,
      lng: effective.value.lng,
      lat: effective.value.lat,
      heading: effective.value.heading,
      speed: effective.value.speed,
    })
  }
  if (mode.value === 'passenger' && passengerWaiting.value) {
    socket.emit('passenger:wait', {
      direction: d,
      destination: destination.value,
      lng: effective.value.lng,
      lat: effective.value.lat,
    })
  }
})

watch(destination, (dest) => {
  if (!effective.value) return
  if (mode.value === 'driver' && driverOnline.value) {
    socket.emit('driver:online', {
      direction: direction.value,
      destination: dest,
      lng: effective.value.lng,
      lat: effective.value.lat,
      heading: effective.value.heading,
      speed: effective.value.speed,
    })
  }
  if (mode.value === 'passenger' && passengerWaiting.value) {
    socket.emit('passenger:wait', {
      direction: direction.value,
      destination: dest,
      lng: effective.value.lng,
      lat: effective.value.lat,
    })
  }
})

watch(mode, () => {
  if (passengerWaiting.value) {
    socket.emit('passenger:cancel_wait')
    passengerWaiting.value = false
  }
  if (driverOnline.value) {
    socket.emit('driver:offline')
    driverOnline.value = false
  }
  driversStore.clear()
  passengersStore.clear()
})

function onMapPick(coords: { lng: number; lat: number }) {
  geoStore.setManual(coords)
  pickMode.value = false
  toast.add({
    severity: 'success',
    summary: 'Position définie',
    detail: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
    life: 2500,
  })
}

function startPickMode() {
  pickMode.value = true
  toast.add({
    severity: 'info',
    summary: 'Clique sur la carte',
    detail: 'Définis ta position précise manuellement.',
    life: 3500,
  })
}

function clearManualPosition() {
  geoStore.clearManual()
  toast.add({
    severity: 'info',
    summary: 'Position manuelle effacée',
    detail: 'Retour au GPS',
    life: 2000,
  })
}

function resyncRealtimeState() {
  if (!effective.value) return
  if (mode.value === 'driver' && driverOnline.value) {
    socket.emit('driver:online', {
      direction: direction.value,
      destination: destination.value,
      lng: effective.value.lng,
      lat: effective.value.lat,
      heading: effective.value.heading,
      speed: effective.value.speed,
    })
  }
  if (mode.value === 'passenger' && passengerWaiting.value) {
    socket.emit('passenger:wait', {
      direction: direction.value,
      destination: destination.value,
      lng: effective.value.lng,
      lat: effective.value.lat,
    })
  }
}

onMounted(async () => {
  await Promise.all([loadVehicles(), loadActiveTrip()])
  socket.on('connect', resyncRealtimeState)
})

onBeforeUnmount(() => {
  socket.off('connect', resyncRealtimeState)
})
</script>

<template>
  <div class="map-page">
    <div class="map-controls safe-top">
      <div class="top-row">
        <SelectButton
          v-if="auth.user?.role === 'both'"
          v-model="mode"
          :options="[
            { label: 'Passager', value: 'passenger' },
            { label: 'Conducteur', value: 'driver' },
          ]"
          option-label="label"
          option-value="value"
          size="small"
        />
        <Tag
          v-else
          :value="mode === 'passenger' ? 'Passager' : 'Conducteur'"
          severity="secondary"
        />
        <Tag
          v-if="geoStore.accuracyLabel"
          :value="geoStore.accuracyLabel"
          :severity="geoStore.accuracySeverity"
        />
      </div>

      <div class="direction-row">
        <span class="label">Direction :</span>
        <SelectButton
          v-model="direction"
          :options="[
            { label: 'Ville', value: 'city' },
            { label: 'Campagne', value: 'country' },
          ]"
          option-label="label"
          option-value="value"
          size="small"
        />
        <Button
          v-if="suggestion && suggestion !== direction"
          text
          size="small"
          :label="`Suggestion: ${suggestion === 'city' ? 'Ville' : 'Campagne'}`"
          @click="direction = suggestion"
        />
      </div>

      <div class="destination-row">
        <span class="label">Destination :</span>
        <Select
          v-model="destination"
          :options="DESTINATION_GROUPS"
          option-group-label="label"
          option-group-children="items"
          option-label="label"
          option-value="value"
          placeholder="Choisir une ville"
          size="small"
          show-clear
          fluid
        />
      </div>
    </div>

    <MapCanvas
      :center-on="geoStore.latLng ? { lng: geoStore.latLng[0], lat: geoStore.latLng[1] } : null"
      :self-position="
        effective
          ? { lng: effective.lng, lat: effective.lat, heading: effective.heading }
          : null
      "
      :pick-mode="pickMode"
      :mode="mode"
      @pick="onMapPick"
    />

    <div class="bottom-panel">
      <template v-if="mode === 'passenger'">
        <Button
          :label="passengerWaiting ? `Arrêter l'attente` : `Je suis en attente`"
          :severity="passengerWaiting ? 'warn' : 'primary'"
          :icon="passengerWaiting ? 'pi pi-times' : 'pi pi-user'"
          fluid
          size="large"
          @click="togglePassengerWait"
        />
        <Button
          v-if="passengerWaiting"
          label="Scanner le QR du conducteur"
          icon="pi pi-qrcode"
          severity="success"
          fluid
          size="large"
          @click="navigateTo('/scan')"
        />
      </template>

      <template v-else>
        <Button
          :label="driverOnline ? 'Passer hors ligne' : 'Je passe en ligne'"
          :severity="driverOnline ? 'warn' : 'primary'"
          :icon="driverOnline ? 'pi pi-power-off' : 'pi pi-car'"
          fluid
          size="large"
          @click="toggleDriverOnline"
        />
        <Button
          v-if="driverOnline"
          label="Afficher mon QR (à scanner par le passager)"
          icon="pi pi-qrcode"
          severity="success"
          fluid
          size="large"
          @click="navigateTo('/scan')"
        />
      </template>

      <div class="manual-row">
        <Button
          :label="pickMode ? 'Annuler' : 'Définir ma position sur la carte'"
          :icon="pickMode ? 'pi pi-times' : 'pi pi-map-marker'"
          size="small"
          :severity="pickMode ? 'warn' : 'secondary'"
          text
          @click="pickMode ? (pickMode = false) : startPickMode()"
        />
        <Button
          v-if="geoStore.manual"
          label="Utiliser le GPS"
          icon="pi pi-compass"
          size="small"
          text
          @click="clearManualPosition"
        />
      </div>

      <div v-if="geoStore.error && !geoStore.manual" class="tr-error" style="text-align: center;">
        {{ geoStore.error }}
      </div>
      <div
        v-else-if="!effective"
        class="tr-subtle"
        style="text-align: center;"
      >
        Localisation en cours...
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.map-controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--p-surface-0);
  border-bottom: 1px solid var(--p-surface-200);
  z-index: 10;
}
.p-dark .map-controls {
  background: var(--p-surface-900);
  border-bottom-color: var(--p-surface-700);
}
.top-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.direction-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.direction-row .label {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}
.destination-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: nowrap;
}
.destination-row .label {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}
.destination-row :deep(.p-select) {
  flex: 1;
  min-width: 0;
}
.bottom-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--p-surface-0);
  border-top: 1px solid var(--p-surface-200);
}
.p-dark .bottom-panel {
  background: var(--p-surface-900);
  border-top-color: var(--p-surface-700);
}
.manual-row {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>
