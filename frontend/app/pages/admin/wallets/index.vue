<script setup lang="ts">
import type { AdminPaginated, AdminWalletListItem } from '~/types/admin'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const admin = useAdminApi()
const fmt = useAdminFormat()
const toast = useToast()

const search = ref('')
const page = ref(1)
const pageSize = 25

const data = ref<AdminPaginated<AdminWalletListItem> | null>(null)
const loading = ref(false)

let searchTimer: ReturnType<typeof setTimeout> | null = null
function debouncedReload() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 250)
}

async function load() {
  loading.value = true
  try {
    data.value = await admin.get<AdminPaginated<AdminWalletListItem>>(
      '/wallets',
      { q: search.value, page: page.value, pageSize },
    )
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

function onPage(event: { page: number; rows: number }) {
  page.value = event.page + 1
  load()
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Wallets</h1>
    </div>
    <div class="filters">
      <span class="p-input-icon-left">
        <i class="pi pi-search" />
        <InputText
          v-model="search"
          placeholder="Email ou nom"
          @input="debouncedReload"
        />
      </span>
    </div>
    <DataTable
      :value="data?.items ?? []"
      :loading="loading"
      data-key="user_id"
      lazy
      paginator
      :rows="pageSize"
      :total-records="data?.total ?? 0"
      :first="((data?.page ?? 1) - 1) * pageSize"
      striped-rows
      @page="onPage"
    >
      <Column header="Utilisateur">
        <template #body="{ data }">
          <NuxtLink :to="`/admin/wallets/${data.user_id}`">
            {{ data.full_name }}
          </NuxtLink>
        </template>
      </Column>
      <Column field="email" header="Email" />
      <Column header="Rôle">
        <template #body="{ data }">
          <Tag
            :value="fmt.formatRole(data.role)"
            :severity="fmt.roleSeverity(data.role)"
          />
        </template>
      </Column>
      <Column header="Solde">
        <template #body="{ data }">
          <span class="balance">{{ fmt.formatXpf(data.balance_xpf) }}</span>
        </template>
      </Column>
      <Column header="Mis à jour">
        <template #body="{ data }">
          {{ fmt.formatDateShort(data.updated_at) }}
        </template>
      </Column>
      <template #empty>Aucun wallet.</template>
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
  margin: 0;
  font-size: 1.5rem;
}
.filters {
  display: flex;
  gap: 0.75rem;
}
.balance {
  font-weight: 600;
  color: var(--p-primary-color);
}
</style>
