import { useAuthStore } from '~/stores/auth'
import { useGeoStore } from '~/stores/geo'
import { usePreferencesStore } from '~/stores/preferences'

export default defineNuxtPlugin(() => {
  useAuthStore().hydrate()
  useGeoStore().hydrateManual()
  usePreferencesStore().hydrate()
})
