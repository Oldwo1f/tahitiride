import { defineStore } from 'pinia'
import { useAuthStore } from '~/stores/auth'

export type UiMode = 'passenger' | 'driver'

const STORAGE_KEY = 'tahiti-ride-ui-mode'

function readPreferred(): UiMode | null {
  if (!import.meta.client) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'driver' || raw === 'passenger' ? raw : null
  } catch {
    return null
  }
}

function writePreferred(value: UiMode) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* ignore */
  }
}

export const useUiModeStore = defineStore('uiMode', {
  state: () => ({
    preferred: 'passenger' as UiMode,
    hydrated: false,
  }),
  getters: {
    /**
     * Effective UI mode: forced by single-role users, configurable for the
     * `both` role. Mirrors the toggle exposed in the /map page so it can be
     * shared with /scan and other surfaces.
     */
    mode(state): UiMode {
      const auth = useAuthStore()
      const role = auth.user?.role
      if (role === 'driver') return 'driver'
      if (role === 'passenger') return 'passenger'
      return state.preferred
    },
    /** True when the current user can switch the mode at will. */
    canToggle(): boolean {
      const auth = useAuthStore()
      return auth.user?.role === 'both'
    },
  },
  actions: {
    hydrate() {
      if (this.hydrated) return
      this.hydrated = true
      const stored = readPreferred()
      if (stored) this.preferred = stored
    },
    setMode(value: UiMode) {
      this.preferred = value
      writePreferred(value)
    },
  },
})
