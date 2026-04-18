import type { $Fetch } from 'nitropack'

export function useApi() {
  const nuxt = useNuxtApp()
  return nuxt.$api as $Fetch
}
