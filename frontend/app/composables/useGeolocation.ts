import { useGeoStore } from '~/stores/geo'

interface GeolocationOptions {
  enableHighAccuracy?: boolean
  maximumAge?: number
  timeout?: number
}

export function useLiveGeolocation(options: GeolocationOptions = {}) {
  const geo = useGeoStore()
  const visible = useDocumentVisibility()
  let watchId: number | null = null

  const start = () => {
    if (!import.meta.client) return
    if (!('geolocation' in navigator)) {
      geo.setError('Geolocation API unavailable')
      return
    }
    if (watchId !== null) return
    watchId = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        geo.setFix({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy ?? null,
          heading:
            typeof coords.heading === 'number' && !Number.isNaN(coords.heading)
              ? coords.heading
              : null,
          speed:
            typeof coords.speed === 'number' && !Number.isNaN(coords.speed)
              ? coords.speed
              : null,
          ts: timestamp,
        })
      },
      (err) => geo.setError(err.message),
      {
        enableHighAccuracy: options.enableHighAccuracy ?? true,
        maximumAge: options.maximumAge ?? 2000,
        timeout: options.timeout ?? 15000,
      },
    )
    geo.setWatching(true)
  }

  const stop = () => {
    if (watchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(watchId)
    }
    watchId = null
    geo.setWatching(false)
  }

  watch(visible, (v) => {
    if (v === 'visible') start()
    else stop()
  })

  onMounted(start)
  onBeforeUnmount(stop)

  return {
    fix: computed(() => geo.fix),
    error: computed(() => geo.error),
    start,
    stop,
  }
}
