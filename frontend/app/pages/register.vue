<script setup lang="ts">
import type { AuthResponse, UserRole } from '~/types/api'

definePageMeta({
  layout: 'auth',
  middleware: ['guest'],
})

const first_name = ref('')
const last_name = ref('')
const email = ref('')
const password = ref('')
const phone = ref('')
const role = ref<UserRole>('both')
const loading = ref(false)
const error = ref<string | null>(null)
const auth = useAuthStore()
const api = useApi()
const toast = useToast()

const roleOptions = [
  { label: 'Passager & conducteur', value: 'both' },
  { label: 'Passager uniquement', value: 'passenger' },
  { label: 'Conducteur uniquement', value: 'driver' },
]

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
        role: role.value,
      },
    })
    auth.setAuth(res)
    toast.add({
      severity: 'success',
      summary: 'Compte créé',
      detail: `+ 10 000 XPF de démo crédités`,
      life: 3500,
    })
    await navigateTo('/map')
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
      <h1>Inscription</h1>
      <p class="tr-subtle">Rejoignez le réseau Tahiti Ride.</p>
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
          <div class="field">
            <label>Rôle</label>
            <Select
              v-model="role"
              :options="roleOptions"
              option-label="label"
              option-value="value"
            />
          </div>
          <div v-if="error" class="tr-error">{{ error }}</div>
          <Button type="submit" label="Créer le compte" :loading="loading" fluid />
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
</style>
