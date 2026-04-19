<script setup lang="ts">
import type {
  AuthUser,
  Certification,
  CertificationType,
  MyCertifications,
  Vehicle,
  VehicleCertification,
} from '~/types/api'
import { usePreferencesStore } from '~/stores/preferences'
import { useUiModeStore, type UiMode } from '~/stores/uiMode'
import { DESTINATION_GROUPS } from '~/utils/destinations'

definePageMeta({
  middleware: ['auth'],
})

const auth = useAuth()
const api = useApi()
const toast = useToast()
const confirm = useConfirm()
const uiModeStore = useUiModeStore()
const prefStore = usePreferencesStore()

const mode = computed<UiMode>({
  get: () => uiModeStore.mode,
  set: (value) => uiModeStore.setMode(value),
})

const homeKey = computed<string | null>({
  get: () => prefStore.home,
  set: (value) => prefStore.setHome(value),
})
const workKey = computed<string | null>({
  get: () => prefStore.work,
  set: (value) => prefStore.setWork(value),
})

const vehicles = ref<Vehicle[]>([])
const loadingVehicles = ref(true)

const certs = ref<MyCertifications | null>(null)
const loadingCerts = ref(true)
const uploadOpen = ref(false)
const uploadType = ref<CertificationType>('license')
const uploadVehicleId = ref<string | null>(null)

const driverWizardOpen = ref(false)
const addVehicleWizardOpen = ref(false)

const editingProfile = ref(false)
const profileForm = reactive({
  first_name: '',
  last_name: '',
  phone: '',
})
const savingProfile = ref(false)
const profileError = ref<string | null>(null)
const avatarSaving = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)

async function loadVehicles() {
  loadingVehicles.value = true
  try {
    vehicles.value = await api<Vehicle[]>('/api/vehicles/mine')
  } catch {
    /* ignore */
  } finally {
    loadingVehicles.value = false
  }
}

async function loadCertifications() {
  if (!auth.isDriver) {
    certs.value = null
    loadingCerts.value = false
    return
  }
  loadingCerts.value = true
  try {
    certs.value = await api<MyCertifications>('/api/certifications/me')
  } catch {
    /* keep previous */
  } finally {
    loadingCerts.value = false
  }
}

async function onDriverWizardFinished() {
  await Promise.all([loadVehicles(), loadCertifications()])
}

async function onAddVehicleFinished() {
  await Promise.all([loadVehicles(), loadCertifications()])
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
    await loadCertifications()
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

function startEditProfile() {
  profileForm.first_name = auth.user?.first_name ?? ''
  profileForm.last_name = auth.user?.last_name ?? ''
  profileForm.phone = auth.user?.phone ?? ''
  profileError.value = null
  editingProfile.value = true
}

async function saveProfile() {
  if (!profileForm.first_name.trim() || !profileForm.last_name.trim()) {
    profileError.value = 'Prénom et nom sont obligatoires'
    return
  }
  savingProfile.value = true
  profileError.value = null
  try {
    const updated = await api<AuthUser>('/api/users/me', {
      method: 'PATCH',
      body: {
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
        phone: profileForm.phone.trim() || null,
      },
    })
    if (auth.user) {
      auth.user = { ...auth.user, ...updated }
      // Persist updates so the next reload reflects new fields.
      auth.setAuth({ token: auth.token, user: auth.user })
    }
    editingProfile.value = false
    toast.add({
      severity: 'success',
      summary: 'Profil mis à jour',
      life: 2500,
    })
  } catch (e: unknown) {
    const data = (e as { data?: { message?: string | string[] } })?.data
    profileError.value =
      (Array.isArray(data?.message) ? data.message.join(', ') : data?.message) ||
      'Échec de la mise à jour'
  } finally {
    savingProfile.value = false
  }
}

function pickAvatar() {
  avatarInput.value?.click()
}

async function onAvatarChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 8 * 1024 * 1024) {
    toast.add({
      severity: 'warn',
      summary: 'Image trop volumineuse',
      detail: '8 Mo maximum',
      life: 3000,
    })
    if (avatarInput.value) avatarInput.value.value = ''
    return
  }
  avatarSaving.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const updated = await api<AuthUser>('/api/users/me/avatar', {
      method: 'POST',
      body: formData,
    })
    if (auth.user) {
      auth.user = { ...auth.user, ...updated }
      auth.setAuth({ token: auth.token, user: auth.user })
    }
    toast.add({
      severity: 'success',
      summary: 'Photo de profil mise à jour',
      life: 2500,
    })
  } catch (e: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail:
        (e as { data?: { message?: string } })?.data?.message ||
        'Téléversement impossible',
      life: 3500,
    })
  } finally {
    avatarSaving.value = false
    if (avatarInput.value) avatarInput.value.value = ''
  }
}

function openLicenseUpload() {
  uploadType.value = 'license'
  uploadVehicleId.value = null
  uploadOpen.value = true
}

function openInsuranceUpload(vehicleId: string) {
  uploadType.value = 'insurance'
  uploadVehicleId.value = vehicleId
  uploadOpen.value = true
}

function onCertSubmitted(_cert: Certification) {
  void _cert
  void loadCertifications()
  void loadVehicles()
}

function vehicleStatusFor(vehicleId: string): VehicleCertification | undefined {
  return certs.value?.vehicles.find((v) => v.vehicle_id === vehicleId)
}

const driverDisplayName = computed<string>(() => {
  const u = auth.user
  if (!u) return ''
  if (u.first_name || u.last_name) {
    return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
  }
  return u.full_name || u.email
})

onMounted(() => {
  void loadVehicles()
  void loadCertifications()
})
</script>

<template>
  <div class="tr-stack">
    <TopBar title="Profil" />

    <Card>
      <template #content>
        <div class="profile-head">
          <div class="profile-avatar-wrap">
            <LetterAvatar
              :src="auth.user?.avatar_url"
              :first-name="auth.user?.first_name"
              :last-name="auth.user?.last_name"
              :full-name="auth.user?.full_name"
              size="xlarge"
            />
            <Button
              icon="pi pi-camera"
              size="small"
              severity="secondary"
              rounded
              class="profile-avatar-btn"
              :loading="avatarSaving"
              aria-label="Changer la photo"
              @click="pickAvatar"
            />
            <input
              ref="avatarInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              @change="onAvatarChange"
            >
          </div>
          <div class="profile-identity">
            <div class="profile-name">{{ driverDisplayName || 'Utilisateur' }}</div>
            <div class="profile-email">{{ auth.user?.email }}</div>
            <div class="profile-meta">
              <Tag
                :value="
                  auth.user?.role === 'admin'
                    ? 'Administrateur'
                    : auth.user?.role === 'both'
                      ? 'Passager & conducteur'
                      : auth.user?.role === 'driver'
                        ? 'Conducteur'
                        : 'Passager'
                "
                :severity="auth.user?.role === 'admin' ? 'warn' : undefined"
              />
              <span v-if="auth.user?.phone" class="tr-subtle profile-phone">
                <i class="pi pi-phone" /> {{ auth.user.phone }}
              </span>
            </div>
          </div>
          <Button
            icon="pi pi-pencil"
            label="Éditer"
            size="small"
            severity="secondary"
            text
            @click="startEditProfile"
          />
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

    <Card
      v-if="!auth.isDriver && !auth.isAdmin"
      class="become-driver-card"
    >
      <template #title>
        <div class="title-row">
          <span><i class="pi pi-car" /> Devenir conducteur</span>
        </div>
      </template>
      <template #content>
        <p class="tr-subtle become-driver-hint">
          Mettez votre véhicule à disposition d'autres utilisateurs en
          quelques minutes. Préparez votre permis et la vignette
          d'assurance — la marque, le modèle et la plaque seront détectés
          automatiquement à partir d'une photo.
        </p>
        <Button
          label="Commencer"
          icon="pi pi-arrow-right"
          icon-pos="right"
          fluid
          @click="driverWizardOpen = true"
        />
      </template>
    </Card>

    <Card v-if="auth.isDriver">
      <template #title>
        <div class="title-row">
          <span><i class="pi pi-id-card" /> Permis de conduire</span>
          <CertificationStatusBadge
            v-if="certs?.license"
            :status="certs.license.status"
            :expires-at="certs.license.expires_at"
          />
          <CertificationStatusBadge v-else status="none" />
        </div>
      </template>
      <template #content>
        <div v-if="loadingCerts" class="tr-center" style="padding: 0.75rem;">
          <ProgressSpinner style="width: 28px; height: 28px;" />
        </div>
        <template v-else>
          <p v-if="!certs?.license" class="tr-subtle">
            Téléversez une photo de votre permis. Le nom doit correspondre à celui du profil.
          </p>
          <div v-else class="cert-detail">
            <div v-if="certs.license.expires_at" class="cert-row">
              <span class="tr-subtle">Validité :</span>
              <strong>{{
                new Intl.DateTimeFormat('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                }).format(new Date(`${certs.license.expires_at}T00:00:00`))
              }}</strong>
            </div>
            <div
              v-if="certs.license.rejection_reason"
              class="cert-row tr-error"
            >
              {{ certs.license.rejection_reason }}
            </div>
          </div>
          <div class="row-end">
            <Button
              :label="
                certs?.license ? 'Mettre à jour' : 'Téléverser mon permis'
              "
              icon="pi pi-camera"
              severity="secondary"
              size="small"
              @click="openLicenseUpload"
            />
          </div>
        </template>
      </template>
    </Card>

    <Card>
      <template #title>Destinations favorites</template>
      <template #content>
        <p class="tr-subtle fav-hint">
          Configure des raccourcis Maison et Travail pour les retrouver
          en haut de la carte. Stocké uniquement sur cet appareil.
        </p>
        <div class="fav-field">
          <label for="fav-home">
            <i class="pi pi-home" /> Maison
          </label>
          <Select
            id="fav-home"
            v-model="homeKey"
            :options="DESTINATION_GROUPS"
            option-group-label="label"
            option-group-children="items"
            option-label="label"
            option-value="value"
            placeholder="Aucune"
            size="small"
            show-clear
            fluid
          />
        </div>
        <div class="fav-field">
          <label for="fav-work">
            <i class="pi pi-briefcase" /> Travail
          </label>
          <Select
            id="fav-work"
            v-model="workKey"
            :options="DESTINATION_GROUPS"
            option-group-label="label"
            option-group-children="items"
            option-label="label"
            option-value="value"
            placeholder="Aucune"
            size="small"
            show-clear
            fluid
          />
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
            @click="addVehicleWizardOpen = true"
          />
        </div>
      </template>
      <template #content>
        <div v-if="loadingVehicles" class="tr-center" style="padding: 1rem;">
          <ProgressSpinner />
        </div>
        <div v-else-if="vehicles.length === 0" class="tr-subtle">
          Ajoutez un véhicule pour pouvoir passer en ligne comme conducteur.
        </div>
        <div v-else class="vehicle-list">
          <div
            v-for="v in vehicles"
            :key="v.id"
            class="vehicle-card"
          >
            <div class="vehicle-photo">
              <img
                v-if="v.photo_url"
                :src="v.photo_url"
                :alt="`Véhicule ${v.plate}`"
              >
              <div v-else class="vehicle-photo-fallback">
                <i class="pi pi-car" />
              </div>
            </div>
            <div class="vehicle-info">
              <div class="vehicle-plate">{{ v.plate }}</div>
              <div class="tr-subtle vehicle-meta">
                {{ v.model }} · {{ v.color }}
              </div>
              <div class="vehicle-cert">
                <CertificationStatusBadge
                  v-if="vehicleStatusFor(v.id)?.latest"
                  :status="vehicleStatusFor(v.id)!.latest!.status"
                  :expires-at="vehicleStatusFor(v.id)?.certified_until"
                />
                <CertificationStatusBadge
                  v-else
                  status="none"
                />
                <small
                  v-if="
                    vehicleStatusFor(v.id)?.needs_renewal_reminder &&
                    vehicleStatusFor(v.id)?.expires_in_days != null
                  "
                  class="vehicle-reminder"
                >
                  <i class="pi pi-exclamation-triangle" />
                  Expire dans {{ vehicleStatusFor(v.id)?.expires_in_days }} j
                </small>
              </div>
            </div>
            <div class="vehicle-actions">
              <Button
                icon="pi pi-camera"
                label="Vignette"
                size="small"
                severity="secondary"
                @click="openInsuranceUpload(v.id)"
              />
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                aria-label="Supprimer"
                @click="askDelete(v)"
              />
            </div>
          </div>
        </div>
      </template>
    </Card>

    <Card v-if="auth.isAdmin">
      <template #title>
        <div class="title-row">
          <span><i class="pi pi-shield admin-icon" /> Administration</span>
        </div>
      </template>
      <template #content>
        <p class="tr-subtle admin-hint">
          Vous disposez d'un accès administrateur. Gérez les utilisateurs,
          les trajets, les wallets et les paramètres de l'application.
        </p>
        <NuxtLink to="/admin" class="admin-link-btn">
          <Button
            label="Ouvrir le back-office"
            icon="pi pi-arrow-right"
            icon-pos="right"
            severity="warn"
            fluid
          />
        </NuxtLink>
      </template>
    </Card>

    <Button
      label="Se déconnecter"
      severity="secondary"
      icon="pi pi-sign-out"
      @click="logout"
    />

    <DriverOnboardingWizard
      v-model:visible="driverWizardOpen"
      @finished="onDriverWizardFinished"
    />

    <AddVehicleWizard
      v-model:visible="addVehicleWizardOpen"
      @finished="onAddVehicleFinished"
    />

    <Dialog
      v-model:visible="editingProfile"
      header="Modifier mon profil"
      modal
      :style="{ width: '92vw', maxWidth: '420px' }"
    >
      <form @submit.prevent="saveProfile" class="veh-form">
        <div class="field">
          <label for="ef">Prénom</label>
          <InputText
            id="ef"
            v-model="profileForm.first_name"
            autocomplete="given-name"
            required
          />
        </div>
        <div class="field">
          <label for="el">Nom</label>
          <InputText
            id="el"
            v-model="profileForm.last_name"
            autocomplete="family-name"
            required
          />
        </div>
        <div class="field">
          <label for="ep">Téléphone</label>
          <InputText
            id="ep"
            v-model="profileForm.phone"
            type="tel"
            autocomplete="tel"
          />
        </div>
        <div v-if="profileError" class="tr-error">{{ profileError }}</div>
        <div class="row-end">
          <Button
            type="button"
            label="Annuler"
            text
            :disabled="savingProfile"
            @click="editingProfile = false"
          />
          <Button type="submit" label="Enregistrer" :loading="savingProfile" />
        </div>
      </form>
    </Dialog>

    <CertificationUploadDialog
      v-model:visible="uploadOpen"
      :type="uploadType"
      :vehicle-id="uploadVehicleId"
      :context-label="
        uploadType === 'insurance' && uploadVehicleId
          ? `Plaque ${
              vehicles.find((v) => v.id === uploadVehicleId)?.plate || ''
            }`
          : null
      "
      @submitted="onCertSubmitted"
    />
  </div>
</template>

<style scoped>
.profile-head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1rem;
}
.profile-avatar-wrap {
  position: relative;
  width: fit-content;
}
.profile-avatar-btn {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 32px;
  height: 32px;
  padding: 0;
}
.profile-identity {
  min-width: 0;
}
.profile-name {
  font-weight: 700;
  font-size: 1.1rem;
}
.profile-email {
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
  word-break: break-all;
}
.profile-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.4rem;
  flex-wrap: wrap;
}
.profile-phone {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
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
.fav-hint {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
}
.fav-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}
.fav-field:last-child {
  margin-bottom: 0;
}
.fav-field label {
  font-size: 0.875rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.cert-detail {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}
.cert-row {
  display: flex;
  gap: 0.4rem;
  font-size: 0.9rem;
}
.row-end {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
.vehicle-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.vehicle-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--p-surface-200);
  border-radius: 8px;
  background: var(--p-surface-0);
}
.p-dark .vehicle-card {
  border-color: var(--p-surface-700);
  background: var(--p-surface-900);
}
.vehicle-photo {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--p-surface-100);
  display: flex;
  align-items: center;
  justify-content: center;
}
.p-dark .vehicle-photo {
  background: var(--p-surface-800);
}
.vehicle-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.vehicle-photo-fallback {
  color: var(--p-text-muted-color);
  font-size: 1.5rem;
}
.vehicle-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  flex: 1;
}
.vehicle-plate {
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.5px;
}
.vehicle-meta {
  font-size: 0.85rem;
}
.vehicle-cert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}
.vehicle-reminder {
  color: var(--p-amber-600);
  font-size: 0.8rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
.vehicle-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}
.become-driver-card :deep(.p-card-title) {
  color: var(--p-primary-color);
}
.become-driver-hint {
  margin: 0 0 0.85rem;
  font-size: 0.9rem;
}
.admin-icon {
  color: var(--p-amber-500);
  margin-right: 0.4rem;
}
.admin-hint {
  margin: 0 0 0.85rem;
  font-size: 0.85rem;
}
.admin-link-btn {
  display: block;
  text-decoration: none;
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

@media (max-width: 480px) {
  .profile-head {
    grid-template-columns: auto 1fr;
  }
  .profile-head > .p-button {
    grid-column: 1 / -1;
    justify-self: end;
  }
}
</style>
