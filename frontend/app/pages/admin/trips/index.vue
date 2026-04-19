<script setup lang="ts">
import type { AdminPaginated, AdminTripListItem } from '~/types/admin'
import type { TripStatus } from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const admin = useAdminApi()
const fmt = useAdminFormat()
const toast = useToast()

const status = ref<TripStatus | null>(null)
const userId = ref<string | null>(null)
const fromDate = ref<Date | null>(null)
const toDate = ref<Date | null>(null)
const page = ref(1)
const pageSize = 25

const data = ref<AdminPaginated<AdminTripListItem> | null>(null)
const loading = ref(false)

const statusOptions = [
  { label: 'Tous', value: null },
  ...(['active', 'completed', 'cancelled'] as TripStatus[]).map((s) => ({
    label: fmt.formatTripStatus(s),
    value: s,
  })),
]

async function load() {
  loading.value = true
  try {
    data.value = await admin.get<AdminPaginated<AdminTripListItem>>('/trips', {
      status: status.value,
      userId: userId.value,
      from: fromDate.value ? fromDate.value.toISOString() : null,
      to: toDate.value ? toDate.value.toISOString() : null,
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

function applyFilters() {
  page.value = 1
  load()
}

function reset() {
  status.value = null
  userId.value = null
  fromDate.value = null
  toDate.value = null
  page.value = 1
  load()
}

function onPage(event: { page: number; rows: number }) {
  page.value = event.page + 1
  load()
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Trajets</h1>
    </div>
    <div class="filters">
      <Select
        v-model="status"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        placeholder="Statut"
        show-clear
      />
      <InputText v-model="userId" placeholder="UUID utilisateur" />
      <DatePicker
        v-model="fromDate"
        placeholder="Depuis"
        date-format="dd/mm/yy"
        show-icon
      />
      <DatePicker
        v-model="toDate"
        placeholder="Jusqu’à"
        date-format="dd/mm/yy"
        show-icon
      />
      <Button label="Filtrer" icon="pi pi-search" @click="applyFilters" />
      <Button
        label="Réinitialiser"
        severity="secondary"
        text
        @click="reset"
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
      <Column header="Statut">
        <template #body="{ data }">
          <Tag
            :value="fmt.formatTripStatus(data.status)"
            :severity="fmt.tripStatusSeverity(data.status)"
          />
        </template>
      </Column>
      <Column header="Démarrage">
        <template #body="{ data }">
          {{ fmt.formatDate(data.started_at) }}
        </template>
      </Column>
      <Column header="Distance">
        <template #body="{ data }">
          {{ fmt.formatDistance(data.distance_m) }}
        </template>
      </Column>
      <Column header="Tarif">
        <template #body="{ data }">
          {{ fmt.formatXpf(data.fare_xpf) }}
        </template>
      </Column>
      <Column header="Part conducteur">
        <template #body="{ data }">
          {{ fmt.formatXpf(data.driver_share_xpf) }}
        </template>
      </Column>
      <Column header="Passager">
        <template #body="{ data }">
          <NuxtLink :to="`/admin/users/${data.passenger_id}`">
            {{ data.passenger_name || '—' }}
          </NuxtLink>
        </template>
      </Column>
      <Column header="Conducteur">
        <template #body="{ data }">
          <NuxtLink :to="`/admin/users/${data.driver_id}`">
            {{ data.driver_name || '—' }}
          </NuxtLink>
        </template>
      </Column>
      <Column header="Véhicule">
        <template #body="{ data }">
          <span v-if="data.vehicle_plate">
            {{ data.vehicle_plate }} ({{ data.vehicle_model }})
          </span>
          <span v-else>—</span>
        </template>
      </Column>
      <Column header="">
        <template #body="{ data }">
          <NuxtLink :to="`/admin/trips/${data.id}`">Détail</NuxtLink>
        </template>
      </Column>
      <template #empty>Aucun trajet.</template>
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
  gap: 0.6rem;
  flex-wrap: wrap;
  align-items: center;
}
</style>
