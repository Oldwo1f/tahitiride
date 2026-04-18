import { useAuthStore } from '~/stores/auth'
import { useGeoStore } from '~/stores/geo'
import { useUiModeStore } from '~/stores/uiMode'

export default defineNuxtPlugin(() => {
  useAuthStore().hydrate()
  useGeoStore().hydrateManual()
  useUiModeStore().hydrate()
})
