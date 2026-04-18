<script setup lang="ts">
import type { Trip } from '~/types/api'
import { useUiModeStore } from '~/stores/uiMode'

definePageMeta({
  layout: 'fullscreen',
  middleware: ['auth'],
})

const auth = useAuth()
const api = useApi()
const toast = useToast()
const geoStore = useGeoStore()
const tripStore = useTripStore()
const uiModeStore = useUiModeStore()
useLiveGeolocation()

type Mode = 'pickup' | 'dropoff'
const mode = ref<Mode>(tripStore.activeTripId ? 'dropoff' : 'pickup')
const submitting = ref(false)
const errorMsg = ref<string | null>(null)

/**
 * Decide what the page should show:
 * - 'qr': the driver's QR code, ready to be scanned by a passenger.
 * - 'scanner': the camera-based scanner used by passengers to pick up / drop off.
 *
 * If a passenger trip is currently active we always show the scanner so the
 * passenger can still trigger the dropoff, even if the user happens to also
 * have the driver role and the UI mode is set to 'driver'.
 */
const view = computed<'qr' | 'scanner'>(() => {
  if (tripStore.activeTripId && tripStore.role === 'passenger') return 'scanner'
  if (uiModeStore.mode === 'driver' && auth.isDriver) return 'qr'
  return 'scanner'
})

const title = computed(() => {
  if (view.value === 'qr') return 'Mon QR conducteur'
  return mode.value === 'pickup' ? 'Monter en voiture' : 'Descendre'
})

async function onDecoded(qrToken: string) {
  if (submitting.value) return
  const pos = geoStore.effective
  if (!pos) {
    errorMsg.value = 'Position GPS nécessaire'
    return
  }
  submitting.value = true
  errorMsg.value = null
  try {
    if (mode.value === 'pickup') {
      const trip = await api<Trip>('/api/trips/pickup', {
        method: 'POST',
        body: {
          qr_token: qrToken,
          lng: pos.lng,
          lat: pos.lat,
        },
      })
      toast.add({
        severity: 'success',
        summary: 'Trajet démarré',
        life: 2500,
      })
      await navigateTo(`/trip/${trip.id}`)
    } else {
      const tripId = tripStore.activeTripId
      if (!tripId) throw new Error('Aucun trajet actif')
      const trip = await api<Trip>(`/api/trips/${tripId}/dropoff`, {
        method: 'POST',
        body: {
          qr_token: qrToken,
          lng: pos.lng,
          lat: pos.lat,
        },
      })
      toast.add({
        severity: 'success',
        summary: 'Trajet terminé',
        detail:
          trip.fare_xpf != null
            ? `${trip.fare_xpf} XPF débités (${Math.round((trip.distance_m || 0) / 100) / 10} km)`
            : undefined,
        life: 4000,
      })
      await navigateTo(`/trip/${trip.id}`)
    }
  } catch (e: unknown) {
    const data = (e as { data?: { message?: string } })?.data
    errorMsg.value =
      data?.message ||
      (e as { message?: string })?.message ||
      'Scan non accepté'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="scan-page">
    <TopBar :title="title" show-back />
    <div v-if="view === 'qr'" class="qr-body safe-bottom">
      <DriverQrCard />
      <p class="tr-subtle qr-hint">
        Présente ce QR au passager au début et à la fin du trajet.
      </p>
    </div>
    <template v-else>
      <div class="scan-body">
        <QrScanner @decoded="onDecoded" @error="errorMsg = $event" />
      </div>
      <div class="scan-hint safe-bottom">
        <p class="tr-subtle">
          {{
            mode === 'pickup'
              ? 'Approchez-vous du conducteur et scannez son QR.'
              : 'Scannez à nouveau le QR pour terminer le trajet.'
          }}
        </p>
        <div v-if="errorMsg" class="tr-error">{{ errorMsg }}</div>
        <div v-if="submitting" class="tr-subtle">Validation en cours...</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.scan-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.scan-body {
  flex: 1;
  background: #000;
  min-height: 0;
  display: flex;
}
.scan-hint {
  padding: 0.75rem 1rem;
  background: var(--p-surface-0);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.p-dark .scan-hint {
  background: var(--p-surface-900);
}
.qr-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--p-surface-0);
  min-height: 0;
  overflow-y: auto;
}
.p-dark .qr-body {
  background: var(--p-surface-900);
}
.qr-hint {
  text-align: center;
  margin: 0;
  max-width: 320px;
}
</style>
