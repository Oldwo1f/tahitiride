<script setup lang="ts">
import type {
  AdminPaginated,
  AdminTripListItem,
  AdminUserDetail,
} from '~/types/admin'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const admin = useAdminApi()
const fmt = useAdminFormat()
const route = useRoute()
const userId = computed(() => route.params.id as string)

const user = ref<AdminUserDetail | null>(null)
const trips = ref<AdminPaginated<AdminTripListItem> | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [u, t] = await Promise.all([
      admin.get<AdminUserDetail>(`/users/${userId.value}`),
      admin.get<AdminPaginated<AdminTripListItem>>('/trips', {
        userId: userId.value,
        page: 1,
        pageSize: 10,
      }),
    ])
    user.value = u
    trips.value = t
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
</script>

<template>
  <div class="page">
    <div class="page-header">
      <NuxtLink to="/admin/users" class="back-link">
        <i class="pi pi-arrow-left" /> Utilisateurs
      </NuxtLink>
    </div>

    <Message v-if="error" severity="error" :closable="false">
      {{ error }}
    </Message>

    <div v-if="loading && !user" class="loading">
      <ProgressSpinner />
    </div>

    <template v-else-if="user">
      <Card>
        <template #title>{{ user.full_name }}</template>
        <template #subtitle>
          {{ user.email }}<span v-if="user.phone"> · {{ user.phone }}</span>
        </template>
        <template #content>
          <div class="profile-grid">
            <div>
              <div class="label">Rôle</div>
              <Tag :value="fmt.formatRole(user.role)" :severity="fmt.roleSeverity(user.role)" />
            </div>
            <div>
              <div class="label">Statut</div>
              <Tag
                v-if="user.suspended_at"
                value="Suspendu"
                severity="danger"
              />
              <Tag
                v-else-if="user.deleted_at"
                value="Supprimé"
                severity="secondary"
              />
              <Tag v-else value="Actif" severity="success" />
            </div>
            <div>
              <div class="label">Inscription</div>
              <div>{{ fmt.formatDate(user.created_at) }}</div>
            </div>
            <div>
              <div class="label">Solde wallet</div>
              <div>
                {{ fmt.formatXpf(user.wallet?.balance_xpf ?? 0) }}
                <NuxtLink
                  :to="`/admin/wallets/${user.id}`"
                  class="inline-link"
                >
                  Détails →
                </NuxtLink>
              </div>
            </div>
          </div>
        </template>
      </Card>

      <Card>
        <template #title>Véhicules</template>
        <template #content>
          <DataTable
            :value="user.vehicles ?? []"
            data-key="id"
            empty-message="Aucun véhicule."
          >
            <Column field="plate" header="Plaque" />
            <Column field="model" header="Modèle" />
            <Column field="color" header="Couleur" />
            <Column header="Ajouté le">
              <template #body="{ data }">
                {{ fmt.formatDateShort(data.created_at) }}
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>

      <Card>
        <template #title>Derniers trajets</template>
        <template #content>
          <DataTable :value="trips?.items ?? []" data-key="id">
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
            <Column header="Rôle">
              <template #body="{ data }">
                {{
                  data.passenger_id === userId
                    ? 'Passager'
                    : 'Conducteur'
                }}
              </template>
            </Column>
            <Column header="">
              <template #body="{ data }">
                <NuxtLink :to="`/admin/trips/${data.id}`">Détail</NuxtLink>
              </template>
            </Column>
            <template #empty>Aucun trajet.</template>
          </DataTable>
        </template>
      </Card>
    </template>
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
  gap: 0.5rem;
}
.back-link {
  text-decoration: none;
  color: var(--p-text-muted-color);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.loading {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}
.profile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}
.label {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.25rem;
}
.inline-link {
  margin-left: 0.5rem;
  font-size: 0.85rem;
}
</style>
