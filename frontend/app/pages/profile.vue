<script setup lang="ts">
import type { Vehicle } from '~/types/api'
import { useUiModeStore, type UiMode } from '~/stores/uiMode'

definePageMeta({
  middleware: ['auth'],
})

const auth = useAuth()
const api = useApi()
const toast = useToast()
const confirm = useConfirm()
const uiModeStore = useUiModeStore()

const mode = computed<UiMode>({
  get: () => uiModeStore.mode,
  set: (value) => uiModeStore.setMode(value),
})

const vehicles = ref<Vehicle[]>([])
const loading = ref(true)
const addOpen = ref(false)
const form = reactive({ plate: '', model: '', color: '' })
const adding = ref(false)
const addError = ref<string | null>(null)

async function loadVehicles() {
  loading.value = true
  try {
    vehicles.value = await api<Vehicle[]>('/api/vehicles/mine')
  } catch {
    /* ignore */
  } finally {
    loading.value = false
  }
}

async function addVehicle() {
  if (!form.plate || !form.model || !form.color) return
  adding.value = true
  addError.value = null
  try {
    const v = await api<Vehicle>('/api/vehicles/mine', {
      method: 'POST',
      body: { plate: form.plate, model: form.model, color: form.color },
    })
    vehicles.value = [...vehicles.value, v]
    form.plate = ''
    form.model = ''
    form.color = ''
    addOpen.value = false
    toast.add({
      severity: 'success',
      summary: 'Véhicule ajouté',
      life: 2500,
    })
  } catch (e: unknown) {
    const data = (e as { data?: { message?: string | string[] } })?.data
    addError.value =
      (Array.isArray(data?.message) ? data.message.join(', ') : data?.message) ||
      'Erreur'
  } finally {
    adding.value = false
  }
}

function askDelete(v: Vehicle) {
  confirm.require({
    message: `Supprimer le véhicule ${v.plate} ?`,
    header: 'Confirmation',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Supprimer',
    rejectLabel: 'Annuler',
    accept: () => removeVehicle(v),
  })
}

async function removeVehicle(v: Vehicle) {
  try {
    await api(`/api/vehicles/mine/${v.id}`, { method: 'DELETE' })
    vehicles.value = vehicles.value.filter((x) => x.id !== v.id)
    toast.add({
      severity: 'success',
      summary: 'Véhicule supprimé',
      life: 2000,
    })
  } catch (e: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail:
        (e as { data?: { message?: string } })?.data?.message || 'Échec',
      life: 3000,
    })
  }
}

function logout() {
  auth.logout()
  navigateTo('/login')
}

onMounted(loadVehicles)
</script>

<template>
  <div class="tr-stack">
    <TopBar title="Profil" />

    <Card>
      <template #title>
        {{ auth.user?.full_name || 'Utilisateur' }}
      </template>
      <template #subtitle>
        {{ auth.user?.email }}
      </template>
      <template #content>
        <div class="info-grid">
          <div>
            <div class="tr-subtle">Rôle</div>
            <div>
              <Tag
                :value="
                  auth.user?.role === 'both'
                    ? 'Passager & conducteur'
                    : auth.user?.role === 'driver'
                      ? 'Conducteur'
                      : 'Passager'
                "
              />
            </div>
          </div>
          <div v-if="auth.user?.phone">
            <div class="tr-subtle">Téléphone</div>
            <div>{{ auth.user.phone }}</div>
          </div>
        </div>

        <div v-if="uiModeStore.canToggle" class="mode-row">
          <div class="tr-subtle mode-label">Mode actif</div>
          <SelectButton
            v-model="mode"
            :options="[
              { label: 'Passager', value: 'passenger' },
              { label: 'Conducteur', value: 'driver' },
            ]"
            option-label="label"
            option-value="value"
            :allow-empty="false"
          />
          <p class="tr-subtle mode-hint">
            Choisis comment tu apparais dans l'application. Tu peux changer à tout moment.
          </p>
        </div>
      </template>
    </Card>

    <Card v-if="auth.isDriver">
      <template #title>
        <div class="title-row">
          <span>Mes véhicules</span>
          <Button
            icon="pi pi-plus"
            label="Ajouter"
            size="small"
            @click="addOpen = true"
          />
        </div>
      </template>
      <template #content>
        <div v-if="loading" class="tr-center" style="padding: 1rem;">
          <ProgressSpinner />
        </div>
        <div v-else-if="vehicles.length === 0" class="tr-subtle">
          Ajoutez un véhicule pour pouvoir passer en ligne comme conducteur.
        </div>
        <DataTable
          v-else
          :value="vehicles"
          data-key="id"
          class="p-datatable-sm"
        >
          <Column field="plate" header="Plaque" />
          <Column field="model" header="Modèle" />
          <Column field="color" header="Couleur" />
          <Column header="">
            <template #body="{ data }">
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                aria-label="Supprimer"
                @click="askDelete(data)"
              />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Button
      label="Se déconnecter"
      severity="secondary"
      icon="pi pi-sign-out"
      @click="logout"
    />

    <Dialog
      v-model:visible="addOpen"
      header="Nouveau véhicule"
      modal
      :style="{ width: '90vw', maxWidth: '400px' }"
    >
      <form @submit.prevent="addVehicle" class="veh-form">
        <div class="field">
          <label for="pl">Plaque</label>
          <InputText id="pl" v-model="form.plate" required maxlength="16" />
        </div>
        <div class="field">
          <label for="md">Modèle</label>
          <InputText id="md" v-model="form.model" required maxlength="80" />
        </div>
        <div class="field">
          <label for="cl">Couleur</label>
          <InputText id="cl" v-model="form.color" required maxlength="40" />
        </div>
        <div v-if="addError" class="tr-error">{{ addError }}</div>
        <div class="row-end">
          <Button
            type="button"
            label="Annuler"
            text
            @click="addOpen = false"
          />
          <Button type="submit" label="Ajouter" :loading="adding" />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<style scoped>
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.mode-row {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--p-surface-200);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.p-dark .mode-row {
  border-top-color: var(--p-surface-700);
}
.mode-label {
  font-size: 0.85rem;
}
.mode-hint {
  font-size: 0.8rem;
  margin: 0;
}
.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.veh-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.row-end {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
