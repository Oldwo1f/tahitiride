<script setup lang="ts">
import type { AuthResponse } from '~/types/api'

definePageMeta({
  layout: 'auth',
  middleware: ['guest'],
})

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const auth = useAuthStore()
const api = useApi()
const toast = useToast()

const route = useRoute()

/**
 * Shared post-login handler used by both the email/password form and
 * the Facebook button: shows a welcome toast then routes based on
 * `?redirect=` (deep link) > admin role > default `/map`.
 */
async function onAuthSuccess(res: AuthResponse) {
  toast.add({
    severity: 'success',
    summary: 'Bienvenue',
    detail: res.user.full_name,
    life: 2000,
  })
  const redirectQuery = route.query.redirect
  const redirect =
    typeof redirectQuery === 'string' ? redirectQuery : null
  if (redirect && redirect.startsWith('/')) {
    await navigateTo(redirect)
  } else if (res.user.role === 'admin') {
    await navigateTo('/admin')
  } else {
    await navigateTo('/map')
  }
}

async function submit() {
  if (!email.value || !password.value) return
  loading.value = true
  error.value = null
  try {
    const res = await api<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    })
    auth.setAuth(res)
    await onAuthSuccess(res)
  } catch (e: unknown) {
    const msg =
      (e as { data?: { message?: string }; message?: string })?.data?.message ||
      (e as { message?: string })?.message ||
      'Erreur de connexion'
    error.value = msg
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-stack">
    <div class="login-hero">
      <img
        src="/kartiki-logo.svg"
        alt="Kartiki"
        class="login-logo"
        width="180"
        height="180"
      />
      <p class="tr-subtle">Covoiturage temps réel, une seule route.</p>
    </div>
    <Card>
      <template #content>
        <form @submit.prevent="submit" class="login-form">
          <div class="field">
            <label for="email">Email</label>
            <InputText
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
            />
          </div>
          <div class="field">
            <label for="password">Mot de passe</label>
            <Password
              id="password"
              v-model="password"
              toggle-mask
              :feedback="false"
              autocomplete="current-password"
              required
              fluid
            />
          </div>
          <div v-if="error" class="tr-error">{{ error }}</div>
          <Button
            type="submit"
            label="Se connecter"
            :loading="loading"
            fluid
          />
          <Divider align="center" type="solid" class="auth-divider">
            <span class="tr-subtle">OU</span>
          </Divider>
          <FacebookLoginButton
            @success="onAuthSuccess"
            @error="(msg) => (error = msg)"
          />
          <div class="tr-subtle" style="text-align: center;">
            Pas de compte ?
            <NuxtLink to="/register">Inscription</NuxtLink>
          </div>
        </form>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.login-stack {
  max-width: 420px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-top: 2rem;
}
.login-hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}
.login-logo {
  display: block;
  width: 180px;
  max-width: 60vw;
  height: auto;
}
.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.auth-divider {
  margin: 0.25rem 0;
}
</style>
