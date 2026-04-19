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

const submitting = ref(false)
const errorMsg = ref<string | null>(null)

/**
 * The QR is now only used by the passenger at pickup time. The fin-de-
 * trajet flow happens entirely from /map (driver) and /trip/[id]
 * (passenger via "Je sors du véhicule"), so:
 *  - if the user already has an active trip as a passenger, redirect to
 *    that trip page (nothing to scan),
 *  - otherwise, drivers see their own QR and passengers see the camera
 *    to start a new trip.
 */
const view = computed<'qr' | 'scanner'>(() => {
  if (uiModeStore.mode === 'driver' && auth.isDriver) return 'qr'
  return 'scanner'
})

const title = computed(() =>
  view.value === 'qr' ? 'Mon QR conducteur' : 'Monter en voiture',
)

watch(
  () => tripStore.activeTripId,
  (tripId) => {
    if (tripId && tripStore.role === 'passenger') {
      navigateTo(`/trip/${tripId}`)
    }
  },
  { immediate: true },
)

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
        Présente ce QR au passager au début du trajet. Plus besoin de le scanner pour descendre.
      </p>
    </div>
    <template v-else>
      <div class="scan-body">
        <QrScanner @decoded="onDecoded" @error="errorMsg = $event" />
      </div>
      <div class="scan-hint safe-bottom">
        <p class="tr-subtle">
          Approche-toi du conducteur et scanne son QR pour démarrer le trajet.
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
