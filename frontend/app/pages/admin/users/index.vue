<script setup lang="ts">
import type { AdminPaginated, AdminUserListItem } from '~/types/admin'
import type { UserRole } from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const admin = useAdminApi()
const fmt = useAdminFormat()
const toast = useToast()
const confirm = useConfirm()

const search = ref('')
const roleFilter = ref<UserRole | null>(null)
const page = ref(1)
const pageSize = 25

const data = ref<AdminPaginated<AdminUserListItem> | null>(null)
const loading = ref(false)
const updating = ref<Set<string>>(new Set())

const roleOptions = [
  { label: 'Tous', value: null },
  ...(['passenger', 'driver', 'both', 'admin'] as UserRole[]).map((r) => ({
    label: fmt.formatRole(r),
    value: r,
  })),
]

const editableRoleOptions = (['passenger', 'driver', 'both', 'admin'] as UserRole[]).map(
  (r) => ({ label: fmt.formatRole(r), value: r }),
)

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
    data.value = await admin.get<AdminPaginated<AdminUserListItem>>(
      '/users',
      {
        q: search.value,
        role: roleFilter.value,
        page: page.value,
        pageSize,
      },
    )
  } catch (e: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail:
        (e as { data?: { message?: string }; message?: string })?.data
          ?.message || 'Chargement impossible',
      life: 4000,
    })
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(roleFilter, () => {
  page.value = 1
  load()
})

async function changeRole(user: AdminUserListItem, role: UserRole) {
  if (user.role === role) return
  updating.value.add(user.id)
  try {
    await admin.patch(`/users/${user.id}/role`, { role })
    user.role = role
    toast.add({
      severity: 'success',
      summary: 'Rôle mis à jour',
      detail: `${user.email} → ${fmt.formatRole(role)}`,
      life: 2500,
    })
  } catch (e: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail:
        (e as { data?: { message?: string } })?.data?.message ||
        'Mise à jour impossible',
      life: 4000,
    })
  } finally {
    updating.value.delete(user.id)
  }
}

async function toggleSuspended(user: AdminUserListItem) {
  const willSuspend = !user.suspended_at
  updating.value.add(user.id)
  try {
    const path = willSuspend
      ? `/users/${user.id}/suspend`
      : `/users/${user.id}/unsuspend`
    await admin.post(path)
    user.suspended_at = willSuspend ? new Date().toISOString() : null
    toast.add({
      severity: 'success',
      summary: willSuspend ? 'Compte suspendu' : 'Compte réactivé',
      detail: user.email,
      life: 2500,
    })
  } catch (e: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail:
        (e as { data?: { message?: string } })?.data?.message ||
        'Action impossible',
      life: 4000,
    })
  } finally {
    updating.value.delete(user.id)
  }
}

function deleteUser(user: AdminUserListItem) {
  confirm.require({
    header: `Supprimer ${user.email} ?`,
    message:
      'Le compte sera marqué comme supprimé. Les trajets et transactions sont conservés. Cette action est tracée dans l’audit.',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Supprimer',
    acceptClass: 'p-button-danger',
    rejectLabel: 'Annuler',
    accept: async () => {
      updating.value.add(user.id)
      try {
        await admin.del(`/users/${user.id}`)
        toast.add({
          severity: 'success',
          summary: 'Utilisateur supprimé',
          detail: user.email,
          life: 2500,
        })
        await load()
      } catch (e: unknown) {
        toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail:
            (e as { data?: { message?: string } })?.data?.message ||
            'Suppression impossible',
          life: 4000,
        })
      } finally {
        updating.value.delete(user.id)
      }
    },
  })
}

function onPage(event: { page: number; rows: number }) {
  page.value = event.page + 1
  load()
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Utilisateurs</h1>
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
      <Select
        v-model="roleFilter"
        :options="roleOptions"
        option-label="label"
        option-value="value"
        placeholder="Filtrer par rôle"
        show-clear
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
      striped-rows
      @page="onPage"
    >
      <Column header="Nom">
        <template #body="{ data }">
          <NuxtLink :to="`/admin/users/${data.id}`">
            {{ data.full_name }}
          </NuxtLink>
        </template>
      </Column>
      <Column field="email" header="Email" />
      <Column field="phone" header="Téléphone">
        <template #body="{ data }">{{ data.phone || '—' }}</template>
      </Column>
      <Column header="Rôle">
        <template #body="{ data }">
          <Select
            :model-value="data.role"
            :options="editableRoleOptions"
            option-label="label"
            option-value="value"
            :disabled="updating.has(data.id)"
            @update:model-value="(v: UserRole) => changeRole(data, v)"
          />
        </template>
      </Column>
      <Column header="Solde">
        <template #body="{ data }">
          {{ fmt.formatXpf(data.balance_xpf) }}
        </template>
      </Column>
      <Column header="Statut">
        <template #body="{ data }">
          <Tag
            v-if="data.suspended_at"
            severity="danger"
            value="Suspendu"
          />
          <Tag v-else severity="success" value="Actif" />
        </template>
      </Column>
      <Column header="Inscription">
        <template #body="{ data }">
          {{ fmt.formatDateShort(data.created_at) }}
        </template>
      </Column>
      <Column header="Actions">
        <template #body="{ data }">
          <div class="row-actions">
            <Button
              :icon="data.suspended_at ? 'pi pi-check' : 'pi pi-ban'"
              :severity="data.suspended_at ? 'success' : 'warn'"
              size="small"
              text
              :title="data.suspended_at ? 'Réactiver' : 'Suspendre'"
              :loading="updating.has(data.id)"
              @click="toggleSuspended(data)"
            />
            <Button
              icon="pi pi-trash"
              severity="danger"
              size="small"
              text
              title="Supprimer"
              :loading="updating.has(data.id)"
              @click="deleteUser(data)"
            />
          </div>
        </template>
      </Column>
      <template #empty>Aucun utilisateur trouvé.</template>
    </DataTable>

    <ConfirmDialog />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.page-header h1 {
  margin: 0;
  font-size: 1.5rem;
}
.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.row-actions {
  display: flex;
  gap: 0.25rem;
}
</style>
