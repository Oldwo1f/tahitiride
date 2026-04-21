import { defineStore } from 'pinia'
import { isValidDestinationKey } from '~/utils/destinations'

const STORAGE_KEY = 'kartiki-preferences'

interface Persisted {
  lastDestination: string | null
  home: string | null
  work: string | null
}

function readPersisted(): Persisted {
  const empty: Persisted = { lastDestination: null, home: null, work: null }
  if (!import.meta.client) return empty
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<Persisted>
    return {
      lastDestination: isValidDestinationKey(parsed.lastDestination)
        ? (parsed.lastDestination as string)
        : null,
      home: isValidDestinationKey(parsed.home) ? (parsed.home as string) : null,
      work: isValidDestinationKey(parsed.work) ? (parsed.work as string) : null,
    }
  } catch {
    return empty
  }
}

function writePersisted(value: Persisted): void {
  if (!import.meta.client) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    /* ignore quota or privacy errors */
  }
}

/**
 * User-local preferences: the last selected destination (so the choice
 * survives reloads / app restarts) and the optional Home / Work shortcuts
 * configured from the profile page.
 *
 * Stored in localStorage only — these are personal device settings and do
 * not need to round-trip through the backend.
 */
export const usePreferencesStore = defineStore('preferences', {
  state: () => ({
    lastDestination: null as string | null,
    home: null as string | null,
    work: null as string | null,
    hydrated: false,
  }),
  getters: {
    hasFavorites(state): boolean {
      return state.home !== null || state.work !== null
    },
  },
  actions: {
    hydrate() {
      if (this.hydrated) return
      this.hydrated = true
      const stored = readPersisted()
      this.lastDestination = stored.lastDestination
      this.home = stored.home
      this.work = stored.work
    },
    persist() {
      writePersisted({
        lastDestination: this.lastDestination,
        home: this.home,
        work: this.work,
      })
    },
    setLastDestination(key: string | null) {
      this.lastDestination = isValidDestinationKey(key) ? key : null
      this.persist()
    },
    setHome(key: string | null) {
      this.home = isValidDestinationKey(key) ? key : null
      this.persist()
    },
    setWork(key: string | null) {
      this.work = isValidDestinationKey(key) ? key : null
      this.persist()
    },
  },
})
