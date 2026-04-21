import { defineStore } from 'pinia'
import type { GeolocationFix } from '~/types/api'

const MANUAL_KEY = 'kartiki-manual-pos'

interface ManualStored {
  lng: number
  lat: number
}

export const useGeoStore = defineStore('geo', {
  state: () => ({
    fix: null as GeolocationFix | null,
    error: null as string | null,
    watching: false,
    manual: null as { lng: number; lat: number } | null,
  }),
  getters: {
    hasFix: (s): boolean => s.fix !== null || s.manual !== null,
    latLng: (s): [number, number] | null => {
      if (s.manual) return [s.manual.lng, s.manual.lat]
      return s.fix ? [s.fix.lng, s.fix.lat] : null
    },
    effective: (s): GeolocationFix | null => {
      if (s.manual) {
        return {
          lng: s.manual.lng,
          lat: s.manual.lat,
          accuracy: 0,
          heading: null,
          speed: null,
          ts: Date.now(),
        }
      }
      return s.fix
    },
    accuracyLabel: (s): string | null => {
      if (s.manual) return 'Position manuelle'
      if (!s.fix) return null
      const a = s.fix.accuracy
      if (a === null) return 'GPS'
      if (a < 50) return `GPS ±${Math.round(a)}m`
      if (a < 1000) return `GPS ±${Math.round(a)}m (faible)`
      return `GPS ±${(a / 1000).toFixed(1)}km (très faible)`
    },
    accuracySeverity: (s): 'success' | 'info' | 'warn' | 'danger' => {
      if (s.manual) return 'info'
      if (!s.fix) return 'warn'
      const a = s.fix.accuracy ?? 9999
      if (a < 50) return 'success'
      if (a < 500) return 'info'
      if (a < 5000) return 'warn'
      return 'danger'
    },
  },
  actions: {
    setFix(fix: GeolocationFix) {
      this.fix = fix
      this.error = null
    },
    setError(msg: string) {
      this.error = msg
    },
    setWatching(v: boolean) {
      this.watching = v
    },
    hydrateManual() {
      if (!import.meta.client) return
      try {
        const raw = localStorage.getItem(MANUAL_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as ManualStored
        if (typeof parsed.lng === 'number' && typeof parsed.lat === 'number') {
          this.manual = { lng: parsed.lng, lat: parsed.lat }
        }
      } catch {
        localStorage.removeItem(MANUAL_KEY)
      }
    },
    setManual(pos: { lng: number; lat: number }) {
      this.manual = pos
      if (import.meta.client) {
        localStorage.setItem(MANUAL_KEY, JSON.stringify(pos))
      }
    },
    clearManual() {
      this.manual = null
      if (import.meta.client) {
        localStorage.removeItem(MANUAL_KEY)
      }
    },
  },
})
