<script setup lang="ts">
import type {
  AdminPaginated,
  AdminVehicleListItem,
} from '~/types/admin'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const admin = useAdminApi()
const fmt = useAdminFormat()
const toast = useToast()
const confirm = useConfirm()

const search = ref('')
const userId = ref('')
const page = ref(1)
const pageSize = 25

const data = ref<AdminPaginated<AdminVehicleListItem> | null>(null)
const loading = ref(false)
const removing = ref<Set<string>>(new Set())

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
    data.value = await admin.get<AdminPaginated<AdminVehicleListItem>>(
      '/vehicles',
      {
        q: search.value,
        userId: userId.value,
        page: page.value,
        pageSize,
      },
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

function deleteVehicle(v: AdminVehicleListItem) {
  confirm.require({
    header: `Supprimer ${v.plate} ?`,
    message:
      'Le véhicule sera supprimé. Les trajets historiques sont conservés mais ne pourront plus être rattachés à ce véhicule. Action tracée.',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Supprimer',
    acceptClass: 'p-button-danger',
    rejectLabel: 'Annuler',
    accept: async () => {
      removing.value.add(v.id)
      try {
        await admin.del(`/vehicles/${v.id}`)
        toast.add({
          severity: 'success',
          summary: 'Véhicule supprimé',
          detail: v.plate,
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
        removing.value.delete(v.id)
      }
    },
  })
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Véhicules</h1>
    </div>
    <div class="filters">
      <span class="p-input-icon-left">
        <i class="pi pi-search" />
        <InputText
          v-model="search"
          placeholder="Plaque, modèle, propriétaire"
          @input="debouncedReload"
        />
      </span>
      <InputText
        v-model="userId"
        placeholder="UUID propriétaire"
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
      striped-rows
      @page="onPage"
    >
      <Column field="plate" header="Plaque" />
      <Column field="model" header="Modèle" />
      <Column field="color" header="Couleur" />
      <Column header="Propriétaire">
        <template #body="{ data }">
          <NuxtLink :to="`/admin/users/${data.user_id}`">
            {{ data.owner_name || '—' }}
          </NuxtLink>
          <div class="email">{{ data.owner_email }}</div>
        </template>
      </Column>
      <Column header="Ajouté">
        <template #body="{ data }">
          {{ fmt.formatDateShort(data.created_at) }}
        </template>
      </Column>
      <Column header="">
        <template #body="{ data }">
          <Button
            icon="pi pi-trash"
            severity="danger"
            text
            size="small"
            :loading="removing.has(data.id)"
            @click="deleteVehicle(data)"
          />
        </template>
      </Column>
      <template #empty>Aucun véhicule.</template>
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
.page-header h1 {
  margin: 0;
  font-size: 1.5rem;
}
.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.email {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}
</style>
