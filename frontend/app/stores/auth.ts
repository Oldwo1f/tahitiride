import { defineStore } from 'pinia'
import { jwtDecode } from 'jwt-decode'
import type { AuthResponse, AuthUser } from '~/types/api'

const STORAGE_KEY = 'tahiti-ride-auth'

interface StoredAuth {
  token: string
  user: AuthUser
}

/**
 * Migrate a persisted `AuthUser` from the legacy role model
 * (`passenger | driver | both | admin`) to the new one (`user | admin`
 * + independent `is_driver` flag). Safe to call on already-migrated data.
 */
function migrateAuthUser(user: AuthUser | null): AuthUser | null {
  if (!user) return null
  const legacyRole = user.role as unknown as string
  let role: AuthUser['role'] = user.role
  let isDriver = user.is_driver === true
  if (legacyRole === 'admin') {
    role = 'admin'
  } else if (legacyRole === 'driver' || legacyRole === 'both') {
    role = 'user'
    isDriver = true
  } else if (legacyRole === 'passenger') {
    role = 'user'
  }
  return { ...user, role, is_driver: isDriver }
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
    isDriver: (s): boolean => s.user?.is_driver === true,
  },
  actions: {
    setAuth(payload: AuthResponse) {
      const user = migrateAuthUser(payload.user)
      this.token = payload.token
      this.user = user
      if (import.meta.client) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ token: payload.token, user }),
        )
      }
    },
    /**
     * Replace the cached user with a fresh copy (e.g. after toggling driver
     * mode or editing the profile) without touching the token.
     */
    setUser(user: AuthUser) {
      const migrated = migrateAuthUser(user)
      this.user = migrated
      if (import.meta.client && this.token) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ token: this.token, user: migrated }),
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
        this.user = migrateAuthUser(parsed.user)
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
