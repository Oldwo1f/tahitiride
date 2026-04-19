<script setup lang="ts">
import type { AuthResponse } from '~/types/api'

/**
 * "Continue with Facebook" button shared by `/login` and `/register`.
 *
 * Flow:
 *  1. Wait for the FB SDK (`$facebookReady`, set up by
 *     `plugins/facebook.client.ts`).
 *  2. Open the OAuth popup with `email` + `public_profile` scopes.
 *  3. POST the returned `accessToken` to `/api/auth/facebook`.
 *  4. Store the local JWT via `useAuthStore().setAuth()` and let the
 *     parent page handle the post-login UX (toast + redirect) via the
 *     `success` event.
 *
 * The button hides itself when `NUXT_PUBLIC_FACEBOOK_APP_ID` is empty
 * so a self-hosted instance with no Facebook app stays clean.
 */

const emit = defineEmits<{
  (e: 'success', payload: AuthResponse): void
  (e: 'error', message: string): void
}>()

const {
  public: { facebookAppId },
} = useRuntimeConfig()
const auth = useAuthStore()
const api = useApi()
const nuxt = useNuxtApp()

const enabled = computed(() => !!facebookAppId)
const loading = ref(false)

async function onClick() {
  if (loading.value) return
  loading.value = true
  try {
    const FB = await nuxt.$facebookReady
    const fbResponse = await new Promise<FB.LoginResponse>((resolve) => {
      FB.login(resolve, { scope: 'email,public_profile' })
    })

    if (fbResponse.status !== 'connected' || !fbResponse.authResponse) {
      // Most common cause: user closed the popup or refused permissions.
      emit('error', 'Connexion Facebook annulée')
      return
    }

    const res = await api<AuthResponse>('/api/auth/facebook', {
      method: 'POST',
      body: { access_token: fbResponse.authResponse.accessToken },
    })
    auth.setAuth(res)
    emit('success', res)
  } catch (e: unknown) {
    const msg =
      (e as { data?: { message?: string }; message?: string })?.data?.message ||
      (e as { message?: string })?.message ||
      'Erreur de connexion Facebook'
    emit('error', msg)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Button
    v-if="enabled"
    type="button"
    severity="contrast"
    :loading="loading"
    fluid
    class="fb-login-btn"
    @click="onClick"
  >
    <span v-if="!loading" class="fb-login-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
        <path
          fill="currentColor"
          d="M13.5 21v-7.5h2.55l.39-3H13.5V8.7c0-.86.27-1.45 1.5-1.45h1.6V4.6c-.28-.04-1.23-.12-2.34-.12-2.31 0-3.9 1.41-3.9 4v2.02H7.8v3h2.56V21h3.14z"
        />
      </svg>
    </span>
    <span>Continuer avec Facebook</span>
  </Button>
</template>

<style scoped>
.fb-login-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.fb-login-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
}
</style>
