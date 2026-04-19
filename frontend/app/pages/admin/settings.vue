<script setup lang="ts">
import type { AdminSetting } from '~/types/admin'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const admin = useAdminApi()
const toast = useToast()

const settings = ref<AdminSetting[]>([])
const drafts = ref<Record<string, number | string>>({})
const saving = ref<Set<string>>(new Set())
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    settings.value = await admin.get<AdminSetting[]>('/settings')
    const next: Record<string, number | string> = {}
    for (const s of settings.value) {
      next[s.key] =
        typeof s.value === 'number' || typeof s.value === 'string'
          ? s.value
          : 0
    }
    drafts.value = next
  } catch (e: unknown) {
    error.value =
      (e as { data?: { message?: string }; message?: string })?.data?.message ||
      (e as { message?: string })?.message ||
      'Chargement impossible'
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function save(setting: AdminSetting) {
  const value = drafts.value[setting.key]
  if (value === undefined || value === null || value === '') {
    toast.add({ severity: 'warn', summary: 'Valeur vide', life: 2500 })
    return
  }
  saving.value.add(setting.key)
  try {
    await admin.patch(`/settings/${setting.key}`, { value })
    toast.add({
      severity: 'success',
      summary: 'Paramètre sauvegardé',
      detail: setting.label,
      life: 2500,
    })
    await load()
  } catch (e: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail:
        (e as { data?: { message?: string } })?.data?.message ||
        'Sauvegarde impossible',
      life: 4000,
    })
  } finally {
    saving.value.delete(setting.key)
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Paramètres</h1>
      <p class="hint">
        Ces valeurs surchargent la configuration `.env` du backend en
        temps réel. Les modifications sont tracées dans l’audit.
      </p>
    </div>

    <Message v-if="error" severity="error" :closable="false">
      {{ error }}
    </Message>

    <div v-if="loading && settings.length === 0" class="loading">
      <ProgressSpinner />
    </div>

    <div class="settings-grid">
      <Card v-for="s in settings" :key="s.key" class="setting-card">
        <template #title>{{ s.label }}</template>
        <template #subtitle>
          <code>{{ s.key }}</code>
        </template>
        <template #content>
          <div class="setting-body">
            <InputNumber
              v-model="(drafts[s.key] as number)"
              :min="s.min"
              :max="s.max"
              :step="1"
              show-buttons
              button-layout="horizontal"
            />
            <div class="meta">
              <div>
                Plage&nbsp;: {{ s.min }} – {{ s.max }}
              </div>
              <div>
                Défaut&nbsp;:
                <strong>{{ s.default }}</strong>
              </div>
              <div v-if="s.override !== null">
                Override actif&nbsp;: <strong>{{ s.override }}</strong>
              </div>
              <div v-else class="meta-muted">
                Aucune surcharge — valeur par défaut.
              </div>
            </div>
            <Button
              label="Sauvegarder"
              icon="pi pi-save"
              :loading="saving.has(s.key)"
              :disabled="drafts[s.key] === s.value"
              @click="save(s)"
            />
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.page-header h1 {
  margin: 0 0 0.25rem 0;
  font-size: 1.5rem;
}
.hint {
  margin: 0;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}
.loading {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}
.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
}
.setting-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.meta {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.meta-muted {
  font-style: italic;
}
</style>
