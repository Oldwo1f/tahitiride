<script setup lang="ts">
import type {
  Direction,
  Trip,
  TripEstimate,
  Vehicle,
  WalletBalance,
  WalletRequestDto,
} from '~/types/api'
import { DESTINATION_GROUPS, getDestination } from '~/utils/destinations'
import { usePreferencesStore } from '~/stores/preferences'
import { usePresenceStore } from '~/stores/presence'

type MapMode = 'passenger' | 'driver'

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
const prefStore = usePreferencesStore()
const presence = usePresenceStore()
const { inferDirection } = useDirection()

useLiveGeolocation()

/**
 * UI mode of the map is directly driven by the `is_driver` flag on the
 * authenticated user. Toggling driver mode in `/profile` updates the
 * auth store which reactively flips this value.
 */
const mode = computed<MapMode>(() =>
  auth.isDriver ? 'driver' : 'passenger',
)
/**
 * Bound to the persisted preference: any change here is mirrored back to
 * localStorage via the store so the destination survives reloads.
 */
const destination = computed<string | null>({
  get: () => prefStore.lastDestination,
  set: (value) => prefStore.setLastDestination(value),
})

const homeLabel = computed(() => getDestination(prefStore.home)?.label ?? null)
const workLabel = computed(() => getDestination(prefStore.work)?.label ?? null)
function pickFavorite(key: string | null) {
  if (!key) return
  destination.value = key
}
/**
 * Presence state is hoisted to `usePresenceStore` so that it survives
 * navigation away from /map (e.g. going to /scan to show the QR code):
 * a local `ref` here would reset to `false` on every re-mount and make
 * the driver appear offline even though the websocket — and therefore
 * the backend `driver_status` row — is still up. We expose computed
 * wrappers so the rest of the file keeps the original `.value` API.
 */
const passengerWaiting = computed<boolean>({
  get: () => presence.passengerWaiting,
  set: (value) => presence.setPassengerWaiting(value),
})
const driverOnline = computed<boolean>({
  get: () => presence.driverOnline,
  set: (value) => presence.setDriverOnline(value),
})
const vehicles = ref<Vehicle[]>([])
const activeTrip = ref<Trip | null>(null)
const pickMode = ref(false)

const estimate = ref<TripEstimate | null>(null)
const estimateLoading = ref(false)
const estimateError = ref<string | null>(null)
let estimateAbort: AbortController | null = null
let estimateDebounce: ReturnType<typeof setTimeout> | null = null

const walletBalance = ref<number | null>(null)

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

/**
 * Fetch the passenger's wallet balance so we can warn when they lack
 * enough credit for the selected trip. Silent on failure: the alerts
 * rely on a non-null balance so a missing value simply hides them.
 */
async function loadWalletBalance() {
  try {
    const res = await api<WalletBalance>('/api/wallet')
    walletBalance.value = res.balance_xpf
  } catch {
    walletBalance.value = null
  }
}

function onWalletRequestUpdated(req: WalletRequestDto): void {
  if (!auth.user || req.user_id !== auth.user.id) return
  if (req.status === 'approved') {
    void loadWalletBalance()
  }
}

const effective = computed(() => geoStore.effective)

const destinationCoords = computed(() => {
  const d = getDestination(destination.value)
  return d ? { lng: d.lng, lat: d.lat } : null
})

/**
 * Direction is now inferred deterministically from the rider's current
 * position and the chosen destination relative to Papeete (see
 * `useDirection`). When either is missing we default to `city`, matching
 * the previous default behaviour, so backend matching never sees `null`.
 */
const direction = computed<Direction>(() => {
  if (!effective.value || !destinationCoords.value) return 'city'
  return inferDirection({
    from: { lng: effective.value.lng, lat: effective.value.lat },
    to: destinationCoords.value,
  })
})

watch(
  () => tripStore.activeTripId,
  (tripId) => {
    // Only the passenger gets dragged to the trip page on pickup. Drivers
    // can carry several passengers, so they stay on the map and manage
    // their pickups/dropoffs from the dedicated bottom sheet.
    if (tripId && tripStore.role === 'passenger') {
      passengerWaiting.value = false
      navigateTo(`/trip/${tripId}`)
    }
  },
)

const confirm = useConfirm()
const handledDropoffRequests = new Set<string>()

/**
 * As soon as a passenger requests to step out, surface a confirm dialog
 * to the driver. Decline simply hides the dialog and keeps the trip
 * active (the driver can still finish from the bottom sheet); accept
 * fires the actual dropoff API call.
 */
async function completeTripFromRequest(tripId: string) {
  if (!effective.value) {
    toast.add({
      severity: 'warn',
      summary: 'Position GPS nécessaire',
      detail: 'Active la localisation pour clôturer le trajet.',
      life: 4000,
    })
    return
  }
  try {
    await api(`/api/trips/${tripId}/complete`, {
      method: 'POST',
      body: { lng: effective.value.lng, lat: effective.value.lat },
    })
    tripStore.dismissPendingDropoff(tripId)
    toast.add({
      severity: 'success',
      summary: 'Trajet terminé',
      life: 3000,
    })
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
  }
}

watch(
  () => tripStore.pendingDropoffList,
  (list) => {
    if (mode.value !== 'driver') return
    for (const req of list) {
      if (handledDropoffRequests.has(req.trip_id)) continue
      handledDropoffRequests.add(req.trip_id)
      confirm.require({
        header: 'Demande de descente',
        message: `${req.passenger_name} signale qu'il sort du véhicule. Confirmer la fin du trajet ?`,
        icon: 'pi pi-bell',
        acceptLabel: 'Confirmer',
        rejectLabel: 'Pas encore',
        acceptProps: { severity: 'success' },
        accept: () => {
          handledDropoffRequests.delete(req.trip_id)
          void completeTripFromRequest(req.trip_id)
        },
        reject: () => {
          // Keep the request in the store so the badge stays visible in
          // the bottom sheet, but allow re-prompting later if a fresh
          // event comes in.
          handledDropoffRequests.delete(req.trip_id)
        },
      })
    }
  },
  { deep: true },
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
    if (insufficientCredit.value) {
      toast.add({
        severity: 'error',
        summary: 'Solde insuffisant',
        detail: 'Rechargez votre compte pour réserver ce trajet.',
        life: 4000,
      })
      return
    }
    if (!ensureDestination()) return
    socket.emit('passenger:wait', {
      direction: direction.value,
      destination: destination.value,
      lng: effective.value.lng,
      lat: effective.value.lat,
    })
    passengerWaiting.value = true
    const dest = getDestination(destination.value)
    toast.add({
      severity: 'info',
      summary: 'En attente',
      detail: dest ? `Destination : ${dest.label}` : undefined,
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

/**
 * Fetch a passenger-facing distance/duration/fare estimate as soon as the
 * user picks a destination. We debounce to avoid hammering the API when
 * the GPS fix wiggles, and abort in-flight requests on rapid changes.
 */
async function refreshEstimate(): Promise<void> {
  if (estimateAbort) {
    estimateAbort.abort()
    estimateAbort = null
  }
  if (
    mode.value !== 'passenger' ||
    !effective.value ||
    !destinationCoords.value
  ) {
    estimate.value = null
    estimateError.value = null
    estimateLoading.value = false
    return
  }
  const controller = new AbortController()
  estimateAbort = controller
  estimateLoading.value = true
  estimateError.value = null
  try {
    const result = await api<TripEstimate>('/api/trips/estimate', {
      method: 'POST',
      body: {
        from_lng: effective.value.lng,
        from_lat: effective.value.lat,
        to_lng: destinationCoords.value.lng,
        to_lat: destinationCoords.value.lat,
      },
      signal: controller.signal,
    })
    if (controller.signal.aborted) return
    estimate.value = result
  } catch (e: unknown) {
    if (controller.signal.aborted) return
    estimate.value = null
    estimateError.value =
      (e as { data?: { message?: string } })?.data?.message ||
      (e as { message?: string })?.message ||
      'Estimation indisponible'
  } finally {
    if (estimateAbort === controller) estimateAbort = null
    estimateLoading.value = false
  }
}

function scheduleEstimate(): void {
  if (estimateDebounce) clearTimeout(estimateDebounce)
  estimateDebounce = setTimeout(() => {
    estimateDebounce = null
    void refreshEstimate()
  }, 250)
}

watch([destination, effective, mode], scheduleEstimate, { immediate: true })

const estimateDistanceLabel = computed(() => {
  if (!estimate.value) return null
  const m = estimate.value.distance_m
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(1)} km`
})

const estimateDurationLabel = computed(() => {
  if (!estimate.value) return null
  const s = estimate.value.duration_s
  if (s < 60) return `${s} s`
  const min = Math.round(s / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const r = min % 60
  return `${h} h ${String(r).padStart(2, '0')}`
})

/**
 * Credit gating for the passenger: the backend never rejects a pickup
 * based on balance (settlement caps the debit at the available funds),
 * so the check is purely a UX nudge to keep the wallet healthy enough
 * to cover the current trip, and ideally the return trip too.
 */
const insufficientCredit = computed<boolean>(() => {
  if (mode.value !== 'passenger') return false
  if (!estimate.value) return false
  if (walletBalance.value === null) return false
  return walletBalance.value < estimate.value.fare_xpf
})

const insufficientForRoundTrip = computed<boolean>(() => {
  if (mode.value !== 'passenger') return false
  if (!estimate.value) return false
  if (walletBalance.value === null) return false
  const fare = estimate.value.fare_xpf
  return walletBalance.value >= fare && walletBalance.value < fare * 2
})

onMounted(async () => {
  await Promise.all([loadVehicles(), loadActiveTrip(), loadWalletBalance()])
  socket.on('wallet:request:updated', onWalletRequestUpdated)
})

onBeforeUnmount(() => {
  socket.off('wallet:request:updated', onWalletRequestUpdated)
  if (estimateDebounce) clearTimeout(estimateDebounce)
  if (estimateAbort) estimateAbort.abort()
})
</script>

<template>
  <div class="map-page">
    <div class="map-controls safe-top">
      <div
        v-if="prefStore.hasFavorites"
        class="favorites-row"
        role="group"
        aria-label="Destinations favorites"
      >
        <Button
          v-if="prefStore.home"
          :label="homeLabel ?? 'Maison'"
          icon="pi pi-home"
          size="small"
          :severity="destination === prefStore.home ? 'primary' : 'secondary'"
          :outlined="destination !== prefStore.home"
          class="fav-btn"
          @click="pickFavorite(prefStore.home)"
        />
        <Button
          v-if="prefStore.work"
          :label="workLabel ?? 'Travail'"
          icon="pi pi-briefcase"
          size="small"
          :severity="destination === prefStore.work ? 'primary' : 'secondary'"
          :outlined="destination !== prefStore.work"
          class="fav-btn"
          @click="pickFavorite(prefStore.work)"
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

      <div
        v-if="mode === 'passenger' && destination"
        class="estimate-row"
        aria-live="polite"
      >
        <template v-if="estimateLoading && !estimate">
          <i class="pi pi-spin pi-spinner" />
          <span class="tr-subtle">Estimation en cours…</span>
        </template>
        <template v-else-if="estimateError">
          <i class="pi pi-exclamation-triangle est-warn" />
          <span class="tr-subtle">{{ estimateError }}</span>
        </template>
        <template v-else-if="estimate">
          <span class="est-cell" title="Distance estimée">
            <i class="pi pi-compass" />
            <span>{{ estimateDistanceLabel }}</span>
          </span>
          <span class="est-cell" title="Durée estimée">
            <i class="pi pi-clock" />
            <span>{{ estimateDurationLabel }}</span>
            <span class="est-hint">(Sans circu)</span>
          </span>
          <span class="est-cell est-fare" title="Prix estimé">
            <i class="pi pi-money-bill" />
            <span>{{ estimate.fare_xpf }} XPF</span>
            <span class="est-hint">(Tarif estimé)</span>
          </span>
        </template>
      </div>

      <Message
        v-if="insufficientCredit"
        severity="error"
        :closable="false"
        class="credit-alert"
      >
        <div class="credit-alert-body">
          <span>Solde insuffisant pour ce trajet. Rechargez votre compte.</span>
          <Button
            label="Recharger"
            icon="pi pi-plus"
            size="small"
            severity="danger"
            @click="navigateTo('/wallet')"
          />
        </div>
      </Message>

      <Message
        v-else-if="insufficientForRoundTrip"
        severity="warn"
        :closable="false"
        class="credit-alert"
      >
        Attention, vous n'avez pas assez de crédit pour faire l'aller-retour.
      </Message>
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

    <DriverActiveTripsSheet v-if="mode === 'driver'" />

    <div class="bottom-panel">
      <template v-if="mode === 'passenger'">
        <Button
          :label="passengerWaiting ? `Arrêter l'attente` : `Je suis en attente`"
          :severity="passengerWaiting ? 'warn' : 'primary'"
          :icon="passengerWaiting ? 'pi pi-times' : 'pi pi-user'"
          :disabled="!passengerWaiting && insufficientCredit"
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
.favorites-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.favorites-row .fav-btn {
  flex: 1 1 0;
  min-width: 0;
  justify-content: center;
}
.favorites-row .fav-btn :deep(.p-button-label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.estimate-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.4rem 0.5rem;
  border-radius: 8px;
  background: var(--p-surface-100);
  font-size: 0.875rem;
}
.p-dark .estimate-row {
  background: var(--p-surface-800);
}
.estimate-row i {
  margin-right: 0.3rem;
}
.estimate-row .est-cell {
  display: inline-flex;
  align-items: center;
}
.estimate-row .est-fare {
  font-weight: 600;
  color: var(--p-primary-color);
}
.estimate-row .est-hint {
  margin-left: 0.25rem;
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--p-text-muted-color);
}
.estimate-row .est-warn {
  color: var(--p-orange-500);
}
.credit-alert-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
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
