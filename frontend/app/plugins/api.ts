import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin(() => {
  const {
    public: { apiBase },
  } = useRuntimeConfig()
  const auth = useAuthStore()

  const api = $fetch.create({
    baseURL: apiBase,
    onRequest({ options }) {
      const headers = new Headers(options.headers)
      if (auth.token) {
        headers.set('Authorization', `Bearer ${auth.token}`)
      }
      options.headers = headers
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        auth.logout()
        if (import.meta.client && !location.pathname.startsWith('/login')) {
          navigateTo('/login')
        }
      }
    },
  })

  return { provide: { api } }
})
