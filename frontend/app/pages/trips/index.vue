<script setup lang="ts">
import type { Trip, TripSummary } from '~/types/api'

definePageMeta({
  middleware: ['auth'],
})

const api = useApi()
const tripStore = useTripStore()
const auth = useAuth()

const activeTrip = ref<Trip | null>(null)
const history = ref<TripSummary[]>([])
const loading = ref(true)
const errorMsg = ref<string | null>(null)

async function load() {
  loading.value = true
  errorMsg.value = null
  try {
    const [active, list] = await Promise.all([
      api<Trip | null>('/api/trips/active'),
      api<TripSummary[]>('/api/trips/mine?limit=50'),
    ])
    activeTrip.value = active
    history.value = list
    tripStore.setFromApi(active, auth.user?.id ?? null)
  } catch (e: unknown) {
    errorMsg.value =
      (e as { data?: { message?: string } })?.data?.message ||
      (e as { message?: string })?.message ||
      'Erreur de chargement'
  } finally {
    loading.value = false
  }
}

const completedTrips = computed(() =>
  history.value.filter((t) => t.id !== activeTrip.value?.id),
)

const myRoleForActive = computed<'passenger' | 'driver' | null>(() => {
  const t = activeTrip.value
  if (!t || !auth.user) return null
  if (t.passenger_id === auth.user.id) return 'passenger'
  if (t.driver_id === auth.user.id) return 'driver'
  return null
})

function partnerForActive(): string | null {
  if (!activeTrip.value) return null
  const summary = history.value.find((t) => t.id === activeTrip.value?.id)
  return summary?.partner_name ?? null
}

function plateForActive(): string | null {
  if (!activeTrip.value) return null
  const summary = history.value.find((t) => t.id === activeTrip.value?.id)
  return summary?.vehicle_plate ?? null
}

function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function durationMinutes(t: TripSummary | Trip): number | null {
  if (!t.ended_at) return null
  const start = new Date(t.started_at).getTime()
  const end = new Date(t.ended_at).getTime()
  return Math.max(0, Math.round((end - start) / 60000))
}

function distanceLabel(meters: number | null): string {
  if (meters == null) return '—'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

function roleLabel(r: 'passenger' | 'driver' | null): string {
  if (r === 'passenger') return 'Passager'
  if (r === 'driver') return 'Conducteur'
  return ''
}

function roleSeverity(
  r: 'passenger' | 'driver' | null,
): 'info' | 'success' | 'secondary' {
  if (r === 'passenger') return 'info'
  if (r === 'driver') return 'success'
  return 'secondary'
}

function statusLabel(s: TripSummary['status']): string {
  if (s === 'active') return 'En cours'
  if (s === 'completed') return 'Terminé'
  return 'Annulé'
}

function statusSeverity(
  s: TripSummary['status'],
): 'success' | 'warn' | 'secondary' {
  if (s === 'active') return 'warn'
  if (s === 'completed') return 'success'
  return 'secondary'
}

function open(id: string) {
  navigateTo(`/trip/${id}`)
}

watch(
  () => tripStore.lastCompleted,
  (ev) => {
    if (ev) load()
  },
)

watch(
  () => tripStore.activeTripId,
  () => load(),
)

onMounted(load)
</script>

<template>
  <div class="trips-page tr-stack">
    <TopBar title="Mes trajets" />

    <Card v-if="loading" class="tr-center">
      <template #content><ProgressSpinner /></template>
    </Card>

    <Message v-else-if="errorMsg" severity="error">{{ errorMsg }}</Message>

    <template v-else>
      <Card v-if="activeTrip" class="active-card" @click="open(activeTrip.id)">
        <template #title>
          <div class="card-title">
            <span>Trajet en cours</span>
            <Tag value="En cours" severity="warn" />
          </div>
        </template>
        <template #content>
          <div class="active-grid">
            <div>
              <div class="tr-subtle">Démarré</div>
              <div class="val">{{ formatDate(activeTrip.started_at) }}</div>
            </div>
            <div>
              <div class="tr-subtle">Rôle</div>
              <div class="val">
                <Tag
                  :value="roleLabel(myRoleForActive)"
                  :severity="roleSeverity(myRoleForActive)"
                />
              </div>
            </div>
            <div v-if="partnerForActive()">
              <div class="tr-subtle">
                {{ myRoleForActive === 'passenger' ? 'Conducteur' : 'Passager' }}
              </div>
              <div class="val">{{ partnerForActive() }}</div>
            </div>
            <div v-if="plateForActive()">
              <div class="tr-subtle">Plaque</div>
              <div class="val mono">{{ plateForActive() }}</div>
            </div>
          </div>
          <Button
            label="Ouvrir le trajet"
            icon="pi pi-arrow-right"
            icon-pos="right"
            severity="primary"
            fluid
            class="open-btn"
            @click.stop="open(activeTrip.id)"
          />
        </template>
      </Card>

      <Card>
        <template #title>
          <div class="card-title">
            <span>Historique</span>
            <Button
              icon="pi pi-refresh"
              text
              size="small"
              :loading="loading"
              aria-label="Rafraîchir"
              @click="load"
            />
          </div>
        </template>
        <template #content>
          <div v-if="completedTrips.length === 0" class="tr-subtle empty">
            Aucun trajet pour l'instant.
          </div>
          <ul v-else class="trip-list">
            <li
              v-for="t in completedTrips"
              :key="t.id"
              class="trip-row"
              role="button"
              tabindex="0"
              @click="open(t.id)"
              @keydown.enter="open(t.id)"
              @keydown.space.prevent="open(t.id)"
            >
              <div class="row-head">
                <Tag
                  :value="roleLabel(t.my_role)"
                  :severity="roleSeverity(t.my_role)"
                />
                <span class="row-date">{{ formatDate(t.started_at) }}</span>
                <Tag
                  :value="statusLabel(t.status)"
                  :severity="statusSeverity(t.status)"
                />
              </div>
              <div class="row-main">
                <div class="row-partner">
                  <i class="pi pi-user" />
                  <strong>{{ t.partner_name }}</strong>
                  <span v-if="t.vehicle_plate" class="mono plate">
                    {{ t.vehicle_plate }}
                  </span>
                </div>
                <div class="row-stats">
                  <span><i class="pi pi-compass" /> {{ distanceLabel(t.distance_m) }}</span>
                  <span v-if="durationMinutes(t) != null">
                    <i class="pi pi-clock" /> {{ durationMinutes(t) }} min
                  </span>
                  <span class="amount" :class="{ debit: t.my_role === 'passenger', credit: t.my_role === 'driver' }">
                    {{ t.my_role === 'passenger' ? '-' : '+' }}{{ t.fare_xpf ?? 0 }} XPF
                  </span>
                </div>
              </div>
            </li>
          </ul>
        </template>
      </Card>
    </template>
  </div>
</template>

<style scoped>
.trips-page {
  padding-bottom: 1rem;
}
.card-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}
.active-card {
  cursor: pointer;
  border: 1px solid var(--p-primary-300);
}
.active-card:hover {
  border-color: var(--p-primary-color);
}
.active-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem 1.25rem;
  margin-bottom: 0.75rem;
}
.active-grid .val {
  font-weight: 600;
  font-size: 1rem;
}
.open-btn {
  margin-top: 0.5rem;
}
.empty {
  text-align: center;
  padding: 1rem 0;
}
.trip-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.trip-row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--p-surface-200);
  background: var(--p-surface-0);
  cursor: pointer;
  transition:
    border-color 120ms ease,
    background 120ms ease;
}
.p-dark .trip-row {
  border-color: var(--p-surface-700);
  background: var(--p-surface-800);
}
.trip-row:hover,
.trip-row:focus-visible {
  border-color: var(--p-primary-color);
  outline: none;
}
.row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.row-date {
  flex: 1;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  text-align: center;
}
.row-main {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.row-partner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.row-stats {
  display: flex;
  gap: 0.85rem;
  flex-wrap: wrap;
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}
.row-stats i {
  margin-right: 0.25rem;
}
.amount {
  margin-left: auto;
  font-weight: 600;
}
.amount.debit {
  color: var(--p-red-500);
}
.amount.credit {
  color: var(--p-green-500);
}
.mono {
  font-family:
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Consolas,
    monospace;
}
.plate {
  padding: 0.05rem 0.4rem;
  border: 1px solid var(--p-surface-300);
  border-radius: 4px;
  font-size: 0.8rem;
}
.p-dark .plate {
  border-color: var(--p-surface-600);
}
</style>
