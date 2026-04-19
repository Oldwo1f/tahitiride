<script setup lang="ts">
import type { Certification, Vehicle } from '~/types/api'

/**
 * 2-step wizard used by existing drivers (or `both`) to add another
 * vehicle from `/profile`. Skips the driver license step since the
 * account is already a driver. Same vehicle photo + insurance flow as
 * the last two steps of `DriverOnboardingWizard`.
 */
const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'finished'): void
}>()

const toast = useToast()

const STEPS = {
  vehicle: '1',
  insurance: '2',
} as const

const activeStep = ref<string>(STEPS.vehicle)
const createdVehicle = ref<Vehicle | null>(null)

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
  activeStep.value = STEPS.vehicle
  createdVehicle.value = null
}

function onVehicleCreated(payload: {
  vehicle: Vehicle
  userPromoted: boolean
}) {
  createdVehicle.value = payload.vehicle
  activeStep.value = STEPS.insurance
}

function onInsuranceSubmitted(_cert: Certification) {
  void _cert
}

function onInsuranceNext() {
  toast.add({
    severity: 'success',
    summary: 'Véhicule ajouté',
    detail: 'Documents en cours de validation si nécessaire.',
    life: 4000,
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
    header="Ajouter un véhicule"
    modal
    maximizable
    :style="{ width: '92vw', maxWidth: '640px' }"
    :closable="true"
    :pt="{ root: { class: 'wizard-dialog' } }"
  >
    <Stepper v-model:value="activeStep" linear>
      <StepList>
        <Step :value="STEPS.vehicle">Véhicule</Step>
        <Step :value="STEPS.insurance">Assurance</Step>
      </StepList>
      <StepPanels>
        <StepPanel :value="STEPS.vehicle">
          <h3 class="step-title">
            <i class="pi pi-car" /> Photo de votre véhicule
          </h3>
          <VehiclePhotoStep
            :can-go-back="false"
            @created="onVehicleCreated"
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
