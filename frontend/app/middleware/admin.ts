import { useAuthStore } from '~/stores/auth'

/**
 * Gate every `/admin/*` route. Three layers:
 *   - hydrate the store from localStorage so refreshes don't lose the JWT;
 *   - send anonymous users to `/login` with a redirect hint so they bounce
 *     back to the admin URL they were trying to reach;
 *   - send non-admin authed users to the regular passenger/driver shell.
 *
 * The server still re-checks the role on every `/api/admin/*` request via
 * `RolesGuard`, so this is purely a UX guard, not a security boundary.
 */
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (!auth.ready) auth.hydrate()
  if (!auth.isAuthed) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  }
  if (!auth.isAdmin) {
    return navigateTo('/map')
  }
})
