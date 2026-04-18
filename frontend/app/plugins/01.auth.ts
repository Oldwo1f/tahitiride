import { useAuthStore } from '~/stores/auth'
import { useGeoStore } from '~/stores/geo'

export default defineNuxtPlugin(() => {
  useAuthStore().hydrate()
  useGeoStore().hydrateManual()
})
