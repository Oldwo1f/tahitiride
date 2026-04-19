import { defineStore } from 'pinia'
import { jwtDecode } from 'jwt-decode'
import type { AuthResponse, AuthUser } from '~/types/api'

const STORAGE_KEY = 'tahiti-ride-auth'

interface StoredAuth {
  token: string
  user: AuthUser
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '' as string,
    user: null as AuthUser | null,
    ready: false,
  }),
  getters: {
    isAuthed: (s) => !!s.token && !!s.user,
    isAdmin: (s): boolean => s.user?.role === 'admin',
    isDriver: (s): boolean =>
      s.user?.role === 'driver' || s.user?.role === 'both',
    isPassenger: (s): boolean =>
      s.user?.role === 'passenger' || s.user?.role === 'both',
  },
  actions: {
    setAuth(payload: AuthResponse) {
      this.token = payload.token
      this.user = payload.user
      if (import.meta.client) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ token: payload.token, user: payload.user }),
        )
      }
    },
    hydrate() {
      if (!import.meta.client) {
        this.ready = true
        return
      }
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) {
          this.ready = true
          return
        }
        const parsed = JSON.parse(raw) as StoredAuth
        if (!parsed.token) {
          this.ready = true
          return
        }
        const decoded = jwtDecode<{ exp?: number }>(parsed.token)
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
          localStorage.removeItem(STORAGE_KEY)
          this.ready = true
          return
        }
        this.token = parsed.token
        this.user = parsed.user
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      } finally {
        this.ready = true
      }
    },
    logout() {
      this.token = ''
      this.user = null
      if (import.meta.client) {
        localStorage.removeItem(STORAGE_KEY)
      }
    },
  },
})
