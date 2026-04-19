<script setup lang="ts">
import type { AdminOverview } from '~/types/admin'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const admin = useAdminApi()
const fmt = useAdminFormat()

const overview = ref<AdminOverview | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    overview.value = await admin.get<AdminOverview>('/overview')
  } catch (e: unknown) {
    error.value =
      (e as { data?: { message?: string }; message?: string })?.data?.message ||
      (e as { message?: string })?.message ||
      'Erreur de chargement'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
})

function chartTheme() {
  return {
    color: '#0ea5e9',
    grid: 'rgba(148, 163, 184, 0.25)',
  }
}

const signupsChart = computed(() => {
  if (!overview.value) return null
  const points = overview.value.users.signups_last_30d
  const t = chartTheme()
  return {
    data: {
      labels: points.map((p) => fmt.formatDateShort(p.date)),
      datasets: [
        {
          label: 'Inscriptions',
          data: points.map((p) => p.count),
          borderColor: t.color,
          backgroundColor: 'rgba(14, 165, 233, 0.15)',
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: t.grid } },
        y: { beginAtZero: true, grid: { color: t.grid } },
      },
    },
  }
})

const tripsChart = computed(() => {
  if (!overview.value) return null
  const points = overview.value.trips.per_day_30d
  const t = chartTheme()
  return {
    data: {
      labels: points.map((p) => fmt.formatDateShort(p.date)),
      datasets: [
        {
          label: 'Trajets',
          data: points.map((p) => p.count),
          backgroundColor: t.color,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: t.grid } },
        y: { beginAtZero: true, grid: { color: t.grid } },
      },
    },
  }
})

const totalSignups30d = computed(() => {
  if (!overview.value) return 0
  return overview.value.users.signups_last_30d.reduce(
    (sum, p) => sum + p.count,
    0,
  )
})
const totalTrips30d = computed(() => {
  if (!overview.value) return 0
  return overview.value.trips.per_day_30d.reduce((sum, p) => sum + p.count, 0)
})
</script>

<template>
  <div class="dashboard">
    <h1>Tableau de bord</h1>
    <Message v-if="error" severity="error" :closable="false">
      {{ error }}
    </Message>
    <div v-if="loading && !overview" class="loading">
      <ProgressSpinner />
    </div>
    <template v-else-if="overview">
      <div class="kpis">
        <Card class="kpi">
          <template #title>Utilisateurs</template>
          <template #content>
            <div class="kpi-value">{{ overview.users.total }}</div>
            <div class="kpi-sub">+{{ totalSignups30d }} sur 30 j</div>
          </template>
        </Card>
        <Card class="kpi">
          <template #title>Trajets</template>
          <template #content>
            <div class="kpi-value">{{ overview.trips.total }}</div>
            <div class="kpi-sub">+{{ totalTrips30d }} sur 30 j</div>
          </template>
        </Card>
        <Card class="kpi">
          <template #title>Marge plateforme (30 j)</template>
          <template #content>
            <div class="kpi-value">
              {{ fmt.formatXpf(overview.finance.platform_revenue_30d_xpf) }}
            </div>
            <div class="kpi-sub">Différence fare − share conducteur</div>
          </template>
        </Card>
        <Card class="kpi">
          <template #title>Solde wallets total</template>
          <template #content>
            <div class="kpi-value">
              {{ fmt.formatXpf(overview.finance.wallet_total_balance_xpf) }}
            </div>
            <div class="kpi-sub">
              {{ Object.keys(overview.users.by_role).length }} rôles actifs
            </div>
          </template>
        </Card>
      </div>

      <div class="charts">
        <Card>
          <template #title>Inscriptions sur 30 jours</template>
          <template #content>
            <div class="chart-wrap">
              <Chart
                v-if="signupsChart"
                type="line"
                :data="signupsChart.data"
                :options="signupsChart.options"
              />
            </div>
          </template>
        </Card>
        <Card>
          <template #title>Trajets sur 30 jours</template>
          <template #content>
            <div class="chart-wrap">
              <Chart
                v-if="tripsChart"
                type="bar"
                :data="tripsChart.data"
                :options="tripsChart.options"
              />
            </div>
          </template>
        </Card>
      </div>

      <Card>
        <template #title>Top conducteurs (30 jours)</template>
        <template #content>
          <DataTable :value="overview.top_drivers" data-key="driver_id">
            <Column field="full_name" header="Nom" />
            <Column field="email" header="Email" />
            <Column field="trips" header="Trajets" />
            <Column header="Revenu conducteur">
              <template #body="{ data }">
                {{ fmt.formatXpf(data.driver_revenue_xpf) }}
              </template>
            </Column>
            <Column header="">
              <template #body="{ data }">
                <NuxtLink :to="`/admin/users/${data.driver_id}`">
                  Voir profil
                </NuxtLink>
              </template>
            </Column>
            <template #empty>
              Aucun trajet complété sur la période.
            </template>
          </DataTable>
        </template>
      </Card>
    </template>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.dashboard h1 {
  margin: 0;
  font-size: 1.5rem;
}
.loading {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}
.kpi-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--p-primary-color);
}
.kpi-sub {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  margin-top: 0.25rem;
}
.charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
}
.chart-wrap {
  height: 240px;
}
</style>
