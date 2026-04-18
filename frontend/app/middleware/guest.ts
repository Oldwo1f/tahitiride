import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware(() => {
  const auth = useAuthStore()
  if (!auth.ready) auth.hydrate()
  if (auth.isAuthed) {
    return navigateTo('/map')
  }
})
