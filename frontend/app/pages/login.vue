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
      <h1>Tahiti Ride</h1>
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
}
.login-hero h1 {
  margin: 0;
  font-size: 2rem;
  color: var(--p-primary-color);
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
</style>
