import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (!auth.ready) auth.hydrate()
  if (!auth.isAuthed && to.path !== '/login' && to.path !== '/register') {
    return navigateTo('/login')
  }
})
