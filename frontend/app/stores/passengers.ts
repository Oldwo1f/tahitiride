import { defineStore } from 'pinia'
import type { NearbyPassenger } from '~/types/api'

export const usePassengersStore = defineStore('passengers', {
  state: () => ({
    map: {} as Record<string, NearbyPassenger & { updated_at: number }>,
  }),
  getters: {
    list: (s): Array<NearbyPassenger & { updated_at: number }> =>
      Object.values(s.map),
  },
  actions: {
    upsert(p: NearbyPassenger) {
      this.map[p.user_id] = { ...p, updated_at: Date.now() }
    },
    replaceAll(passengers: NearbyPassenger[]) {
      const now = Date.now()
      this.map = {}
      for (const p of passengers) {
        this.map[p.user_id] = { ...p, updated_at: now }
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
