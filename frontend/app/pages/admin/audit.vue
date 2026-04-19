<script setup lang="ts">
import type { AdminAction, AdminPaginated } from '~/types/admin'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const admin = useAdminApi()
const fmt = useAdminFormat()
const toast = useToast()

const actorId = ref('')
const actionFilter = ref<string | null>(null)
const page = ref(1)
const pageSize = 25

const data = ref<AdminPaginated<AdminAction> | null>(null)
const loading = ref(false)
const expanded = ref<Record<string, boolean>>({})

const ACTION_OPTIONS = [
  { label: 'Toutes', value: null },
  { label: 'wallet.adjust', value: 'wallet.adjust' },
  { label: 'user.role.update', value: 'user.role.update' },
  { label: 'user.suspend', value: 'user.suspend' },
  { label: 'user.unsuspend', value: 'user.unsuspend' },
  { label: 'user.delete', value: 'user.delete' },
  { label: 'trip.cancel', value: 'trip.cancel' },
  { label: 'vehicle.delete', value: 'vehicle.delete' },
  { label: 'settings.update', value: 'settings.update' },
]

const ACTION_LABEL: Record<string, string> = {
  'wallet.adjust': 'Ajustement wallet',
  'user.role.update': 'Changement de rôle',
  'user.suspend': 'Suspension',
  'user.unsuspend': 'Réactivation',
  'user.delete': 'Suppression utilisateur',
  'trip.cancel': 'Annulation trajet',
  'vehicle.delete': 'Suppression véhicule',
  'settings.update': 'Modification paramètre',
}

async function load() {
  loading.value = true
  try {
    data.value = await admin.get<AdminPaginated<AdminAction>>('/audit', {
      actorId: actorId.value,
      action: actionFilter.value,
      page: page.value,
      pageSize,
    })
  } catch (e: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail:
        (e as { data?: { message?: string } })?.data?.message ||
        'Chargement impossible',
      life: 4000,
    })
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(actionFilter, () => {
  page.value = 1
  load()
})

let actorTimer: ReturnType<typeof setTimeout> | null = null
function debouncedReload() {
  if (actorTimer) clearTimeout(actorTimer)
  actorTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 250)
}

function onPage(event: { page: number; rows: number }) {
  page.value = event.page + 1
  load()
}

function targetLink(action: AdminAction): string | null {
  if (!action.target_id) return null
  if (action.target_type === 'user') return `/admin/users/${action.target_id}`
  if (action.target_type === 'trip') return `/admin/trips/${action.target_id}`
  return null
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Audit</h1>
      <p class="hint">
        Journal immuable des actions admin. Nouveau plus récent en haut.
      </p>
    </div>
    <div class="filters">
      <Select
        v-model="actionFilter"
        :options="ACTION_OPTIONS"
        option-label="label"
        option-value="value"
        placeholder="Type d’action"
        show-clear
      />
      <InputText
        v-model="actorId"
        placeholder="UUID de l’admin acteur"
        @input="debouncedReload"
      />
    </div>
    <DataTable
      :value="data?.items ?? []"
      :loading="loading"
      data-key="id"
      lazy
      paginator
      :rows="pageSize"
      :total-records="data?.total ?? 0"
      :first="((data?.page ?? 1) - 1) * pageSize"
      @page="onPage"
    >
      <Column header="Date">
        <template #body="{ data }">
          {{ fmt.formatDate(data.created_at) }}
        </template>
      </Column>
      <Column header="Acteur">
        <template #body="{ data }">
          <div>{{ data.actor_email || data.actor_user_id }}</div>
        </template>
      </Column>
      <Column header="Action">
        <template #body="{ data }">
          <Tag
            :value="ACTION_LABEL[data.action] ?? data.action"
            severity="info"
          />
        </template>
      </Column>
      <Column header="Cible">
        <template #body="{ data }">
          <NuxtLink v-if="targetLink(data)" :to="targetLink(data) || ''">
            {{ data.target_type }} · {{ (data.target_id || '').slice(0, 8) }}…
          </NuxtLink>
          <span v-else>{{ data.target_type }}</span>
        </template>
      </Column>
      <Column header="Détails">
        <template #body="{ data }">
          <Button
            label="Voir"
            severity="secondary"
            text
            size="small"
            icon="pi pi-eye"
            @click="expanded[data.id] = !expanded[data.id]"
          />
          <pre v-if="expanded[data.id]" class="payload">{{ JSON.stringify(data.payload, null, 2) }}</pre>
        </template>
      </Column>
      <template #empty>Aucun événement.</template>
    </DataTable>
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
.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.payload {
  margin-top: 0.5rem;
  padding: 0.6rem;
  background: var(--p-surface-100);
  border-radius: 4px;
  font-size: 0.8rem;
  max-width: 480px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.p-dark .payload {
  background: var(--p-surface-800);
}
</style>
