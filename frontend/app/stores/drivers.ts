import { defineStore } from 'pinia'
import type { NearbyDriver } from '~/types/api'

export const useDriversStore = defineStore('drivers', {
  state: () => ({
    map: {} as Record<string, NearbyDriver & { updated_at: number }>,
  }),
  getters: {
    list: (s): Array<NearbyDriver & { updated_at: number }> =>
      Object.values(s.map),
  },
  actions: {
    upsert(d: NearbyDriver) {
      this.map[d.user_id] = { ...d, updated_at: Date.now() }
    },
    replaceAll(drivers: NearbyDriver[]) {
      const now = Date.now()
      this.map = {}
      for (const d of drivers) {
        this.map[d.user_id] = { ...d, updated_at: now }
      }
    },
    remove(userId: string) {
      delete this.map[userId]
    },
    clear() {
      this.map = {}
    },
    pruneOlderThan(ms: number) {
      const cutoff = Date.now() - ms
      for (const id of Object.keys(this.map)) {
        const entry = this.map[id]
        if (entry && entry.updated_at < cutoff) delete this.map[id]
      }
    },
  },
})
