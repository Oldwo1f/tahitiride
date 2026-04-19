import { useAuthStore } from '~/stores/auth'
import { useGeoStore } from '~/stores/geo'
import { usePreferencesStore } from '~/stores/preferences'
import { useUiModeStore } from '~/stores/uiMode'

export default defineNuxtPlugin(() => {
  useAuthStore().hydrate()
  useGeoStore().hydrateManual()
  useUiModeStore().hydrate()
  usePreferencesStore().hydrate()
})
