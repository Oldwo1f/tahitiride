<script setup lang="ts">
import type { AuthUser, Certification, Vehicle } from '~/types/api'

/**
 * 3-step wizard that activates driver mode for any user:
 *   1. Driver license upload (`POST /certifications/license`)
 *   2. Vehicle photo + AI-assisted creation (`POST /vehicles/photo/analyze`
 *      then `POST /vehicles/mine`) — the backend flips `is_driver=true`
 *      on the first vehicle created.
 *   3. Insurance vignette (`POST /certifications/vehicle/:id/insurance`)
 *
 * Embedded in a full-screen Dialog opened from `/profile`. On finish we
 * refresh the auth user (so the driver-only UI unlocks) and emit
 * `finished` so the parent can reload its vehicles / certifications.
 */
const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'finished'): void
}>()

const api = useApi()
const auth = useAuthStore()
const toast = useToast()

const STEPS = {
  license: '1',
  vehicle: '2',
  insurance: '3',
} as const

const activeStep = ref<string>(STEPS.license)
const licenseDone = ref(false)
const createdVehicle = ref<Vehicle | null>(null)
const insuranceDone = ref(false)

const visibleProxy = computed<boolean>({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

watch(
  () => props.visible,
  (v) => {
    if (v) reset()
  },
)

function reset() {
  activeStep.value = STEPS.license
  licenseDone.value = false
  createdVehicle.value = null
  insuranceDone.value = false
}

function onLicenseSubmitted(_cert: Certification) {
  void _cert
  licenseDone.value = true
}

function onLicenseNext() {
  activeStep.value = STEPS.vehicle
}

async function onVehicleCreated(payload: {
  vehicle: Vehicle
  userPromoted: boolean
}) {
  createdVehicle.value = payload.vehicle
  if (payload.userPromoted) {
    await refreshAuthUser()
  }
  activeStep.value = STEPS.insurance
}

function onInsuranceSubmitted(_cert: Certification) {
  void _cert
  insuranceDone.value = true
}

async function onInsuranceNext() {
  await finish()
}

async function refreshAuthUser() {
  try {
    const me = await api<AuthUser>('/api/users/me')
    auth.setUser(me)
  } catch {
    // The flag flip will be picked up on the next navigation; not fatal.
  }
}

async function finish() {
  // Belt + suspenders: refresh the user one more time in case the
  // is_driver flip happened during the vehicle step but the call above
  // failed, or if some other server-side change occurred.
  await refreshAuthUser()
  toast.add({
    severity: 'success',
    summary: 'Mode conducteur activé',
    detail:
      'Votre profil est complet. Une validation manuelle peut être en cours pour les documents.',
    life: 5000,
  })
  emit('finished')
  visibleProxy.value = false
}

function close() {
  visibleProxy.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visibleProxy"
    header="Devenir conducteur"
    modal
    maximizable
    :style="{ width: '92vw', maxWidth: '640px' }"
    :closable="true"
    :pt="{ root: { class: 'wizard-dialog' } }"
  >
    <Stepper v-model:value="activeStep" linear>
      <StepList>
        <Step :value="STEPS.license">Permis</Step>
        <Step :value="STEPS.vehicle">Véhicule</Step>
        <Step :value="STEPS.insurance">Assurance</Step>
      </StepList>
      <StepPanels>
        <StepPanel :value="STEPS.license">
          <h3 class="step-title">
            <i class="pi pi-id-card" /> Photo de votre permis
          </h3>
          <CertificationUploadStep
            type="license"
            :can-go-back="false"
            @submitted="onLicenseSubmitted"
            @next="onLicenseNext"
          />
        </StepPanel>

        <StepPanel :value="STEPS.vehicle">
          <h3 class="step-title">
            <i class="pi pi-car" /> Photo de votre véhicule
          </h3>
          <VehiclePhotoStep
            :can-go-back="true"
            helper-text="Prenez votre véhicule en photo de 3/4 face. La marque, le modèle, la couleur et la plaque seront pré-remplis automatiquement par l'IA — vérifiez et corrigez si besoin."
            @created="onVehicleCreated"
            @back="activeStep = STEPS.license"
          />
        </StepPanel>

        <StepPanel :value="STEPS.insurance">
          <h3 class="step-title">
            <i class="pi pi-shield" /> Vignette d'assurance
          </h3>
          <CertificationUploadStep
            v-if="createdVehicle"
            type="insurance"
            :vehicle-id="createdVehicle.id"
            :context-label="`Plaque ${createdVehicle.plate}`"
            :can-go-back="false"
            @submitted="onInsuranceSubmitted"
            @next="onInsuranceNext"
          />
        </StepPanel>
      </StepPanels>
    </Stepper>

    <template #footer>
      <Button
        label="Fermer"
        text
        severity="secondary"
        @click="close"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.step-title {
  margin: 0 0 1rem;
  font-size: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--p-primary-color);
}
</style>

<style>
.wizard-dialog .p-dialog-content {
  padding-top: 1.25rem;
}
</style>
