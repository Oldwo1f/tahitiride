<script setup lang="ts">
import type { AuthResponse } from '~/types/api'

definePageMeta({
  layout: 'auth',
  middleware: ['guest'],
})

const first_name = ref('')
const last_name = ref('')
const email = ref('')
const password = ref('')
const phone = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const auth = useAuthStore()
const api = useApi()
const toast = useToast()

/**
 * Shared post-signup handler used by both the email/password form and
 * the Facebook button. Lands on /map regardless of role: drivers will
 * be auto-promoted by the onboarding wizard the first time they add a
 * vehicle from /profile.
 */
async function onAuthSuccess(res: AuthResponse) {
  toast.add({
    severity: 'success',
    summary: 'Compte créé',
    detail: `Bienvenue ${res.user.full_name}. + 10 000 XPF de démo crédités.`,
    life: 4500,
  })
  await navigateTo('/map')
}

async function submit() {
  if (
    !first_name.value ||
    !last_name.value ||
    !email.value ||
    password.value.length < 8
  )
    return
  loading.value = true
  error.value = null
  try {
    const res = await api<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: {
        first_name: first_name.value,
        last_name: last_name.value,
        email: email.value,
        password: password.value,
        phone: phone.value || undefined,
      },
    })
    auth.setAuth(res)
    await onAuthSuccess(res)
  } catch (e: unknown) {
    const data = (e as { data?: { message?: string | string[] } })?.data
    const msg =
      (Array.isArray(data?.message) ? data.message.join(', ') : data?.message) ||
      (e as { message?: string })?.message ||
      'Erreur'
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
        class="login-logo register-logo"
        width="120"
        height="120"
      />
      <h1>Inscription</h1>
      <p class="tr-subtle">Rejoignez le réseau Kartiki.</p>
    </div>
    <Card>
      <template #content>
        <form @submit.prevent="submit" class="login-form">
          <div class="name-row">
            <div class="field">
              <label for="fn">Prénom</label>
              <InputText
                id="fn"
                v-model="first_name"
                autocomplete="given-name"
                required
                fluid
              />
            </div>
            <div class="field">
              <label for="ln">Nom</label>
              <InputText
                id="ln"
                v-model="last_name"
                autocomplete="family-name"
                required
                fluid
              />
            </div>
          </div>
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
            <label for="phone">Téléphone (optionnel)</label>
            <InputText
              id="phone"
              v-model="phone"
              type="tel"
              autocomplete="tel"
            />
          </div>
          <div class="field">
            <label for="pwd">Mot de passe (≥ 8 caractères)</label>
            <Password
              id="pwd"
              v-model="password"
              toggle-mask
              :feedback="false"
              autocomplete="new-password"
              required
              fluid
            />
          </div>
          <Message severity="info" :closable="false" class="role-hint">
            Vous serez inscrit en tant que passager. Vous pourrez devenir
            conducteur depuis votre profil.
          </Message>
          <div v-if="error" class="tr-error">{{ error }}</div>
          <Button type="submit" label="Créer le compte" :loading="loading" fluid />
          <Divider align="center" type="solid" class="auth-divider">
            <span class="tr-subtle">OU</span>
          </Divider>
          <FacebookLoginButton
            @success="onAuthSuccess"
            @error="(msg) => (error = msg)"
          />
          <div class="tr-subtle" style="text-align: center;">
            Déjà inscrit ?
            <NuxtLink to="/login">Connexion</NuxtLink>
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
  height: auto;
}
.register-logo {
  width: 120px;
  max-width: 40vw;
}
.login-hero h1 {
  margin: 0;
  font-size: 1.75rem;
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
.name-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.role-hint {
  font-size: 0.85rem;
}
.auth-divider {
  margin: 0.25rem 0;
}
</style>
