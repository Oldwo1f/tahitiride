<script setup lang="ts">
import type {
  CreateVehicleResponse,
  OcrVehicleExtraction,
  Vehicle,
} from '~/types/api'

/**
 * Single-step UI to capture a 3/4 face photo of the user's vehicle, send
 * it to the OCR backend (`POST /api/vehicles/photo/analyze`), let the
 * user adjust the pre-filled fields, then create the vehicle (`POST
 * /api/vehicles/mine`). Used by both `DriverOnboardingWizard` (3 steps)
 * and `AddVehicleWizard` (2 steps).
 */
const emit = defineEmits<{
  (e: 'created', payload: { vehicle: Vehicle; userPromoted: boolean }): void
  (e: 'back'): void
}>()

defineProps<{
  /**
   * Whether the user can go back to a previous step. When false (typical
   * first step) the back button is hidden.
   */
  canGoBack?: boolean
  /**
   * Optional helper sentence displayed above the photo picker. Defaults
   * to a generic prompt; the onboarding wizard overrides it to mention
   * the role promotion.
   */
  helperText?: string
}>()

const api = useApi()
const toast = useToast()

const fileInput = ref<HTMLInputElement | null>(null)
const fileMeta = ref<{ name: string; size: number } | null>(null)
const previewUrl = ref<string | null>(null)
const selectedFile = ref<File | null>(null)

const analyzing = ref(false)
const extraction = ref<OcrVehicleExtraction | null>(null)

const form = reactive({
  plate: '',
  make: '',
  model: '',
  color: '',
})

const submitting = ref(false)
const errorMsg = ref<string | null>(null)

const canSubmit = computed(
  () =>
    !!selectedFile.value &&
    form.plate.trim().length > 0 &&
    form.model.trim().length > 0 &&
    form.color.trim().length > 0,
)

const confidencePct = computed(() => {
  const c = extraction.value?.confidence
  if (typeof c !== 'number') return null
  return Math.round(c * 100)
})

const confidenceSeverity = computed<'success' | 'warn' | 'danger'>(() => {
  const pct = confidencePct.value
  if (pct == null || pct < 50) return 'danger'
  if (pct < 80) return 'warn'
  return 'success'
})

function pickFile() {
  fileInput.value?.click()
}

function resetExtraction() {
  extraction.value = null
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 8 * 1024 * 1024) {
    errorMsg.value = 'Photo trop volumineuse (8 Mo maximum)'
    return
  }
  if (!/^image\/(jpeg|png|webp|jpg)$/i.test(file.type)) {
    errorMsg.value = 'Format non supporté (JPEG, PNG ou WebP)'
    return
  }
  errorMsg.value = null
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(file)
  fileMeta.value = { name: file.name, size: file.size }
  selectedFile.value = file
  resetExtraction()
  await analyze(file)
}

async function analyze(file: File) {
  analyzing.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api<OcrVehicleExtraction>(
      '/api/vehicles/photo/analyze',
      { method: 'POST', body: formData },
    )
    extraction.value = res
    if (res.plate) form.plate = res.plate
    if (res.model) form.model = res.model
    if (res.color) form.color = res.color
    if (res.make) form.make = res.make
  } catch (e: unknown) {
    extraction.value = {
      make: null,
      model: null,
      color: null,
      plate: null,
      confidence: 0,
      decision_notes:
        (e as { data?: { message?: string } })?.data?.message ||
        'Analyse impossible — saisissez les champs manuellement',
    }
  } finally {
    analyzing.value = false
  }
}

async function submit() {
  if (!canSubmit.value || !selectedFile.value) return
  submitting.value = true
  errorMsg.value = null
  try {
    const formData = new FormData()
    formData.append('photo', selectedFile.value)
    formData.append('plate', form.plate.trim().toUpperCase())
    // We concatenate make + model into the single `model` column the
    // backend stores, since the entity does not split them. The make is
    // still useful for the OCR loop (badge / context shown to the user).
    const fullModel = form.make
      ? `${form.make.trim()} ${form.model.trim()}`.trim()
      : form.model.trim()
    formData.append('model', fullModel)
    formData.append('color', form.color.trim())
    const res = await api<CreateVehicleResponse>('/api/vehicles/mine', {
      method: 'POST',
      body: formData,
    })
    emit('created', {
      vehicle: res.vehicle,
      userPromoted: res.user_promoted,
    })
    toast.add({
      severity: 'success',
      summary: res.user_promoted
        ? 'Véhicule enregistré · mode conducteur activé'
        : 'Véhicule enregistré',
      life: 3000,
    })
  } catch (e: unknown) {
    const data = (e as { data?: { message?: string | string[] } })?.data
    errorMsg.value =
      (Array.isArray(data?.message) ? data.message.join(', ') : data?.message) ||
      (e as { message?: string })?.message ||
      'Erreur lors de la création du véhicule'
  } finally {
    submitting.value = false
  }
}

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <div class="vp-step">
    <p class="vp-help">
      {{
        helperText ||
        'Prenez une photo de 3/4 face de votre véhicule, comme si vous étiez sur le bord de la route. La marque, le modèle, la couleur et la plaque seront pré-remplis automatiquement.'
      }}
    </p>

    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      capture="environment"
      hidden
      @change="onFileChange"
    >

    <div v-if="!previewUrl" class="vp-picker">
      <Button
        icon="pi pi-camera"
        label="Prendre une photo du véhicule"
        size="large"
        @click="pickFile"
      />
    </div>

    <div v-else class="vp-preview-wrap">
      <div class="vp-preview">
        <img :src="previewUrl" alt="Photo du véhicule" >
        <Button
          v-if="!submitting"
          icon="pi pi-refresh"
          label="Reprendre"
          size="small"
          severity="secondary"
          class="vp-retake"
          @click="pickFile"
        />
      </div>

      <div v-if="analyzing" class="vp-analyzing">
        <ProgressSpinner style="width: 24px; height: 24px;" />
        <span>Analyse de la photo en cours…</span>
      </div>

      <div v-else-if="extraction" class="vp-form">
        <div class="vp-confidence">
          <Tag
            v-if="confidencePct != null"
            :severity="confidenceSeverity"
            :value="`Confiance IA: ${confidencePct}%`"
          />
          <Tag
            v-else
            severity="secondary"
            value="Saisie manuelle"
          />
          <small
            v-if="extraction.decision_notes"
            class="vp-notes"
          >{{ extraction.decision_notes }}</small>
        </div>

        <div class="vp-grid">
          <div class="vp-field">
            <label for="vp-make">Marque</label>
            <InputText
              id="vp-make"
              v-model="form.make"
              maxlength="40"
              placeholder="Toyota, Renault…"
            />
          </div>
          <div class="vp-field">
            <label for="vp-model">Modèle</label>
            <InputText
              id="vp-model"
              v-model="form.model"
              maxlength="40"
              placeholder="Corolla, Clio…"
              required
            />
          </div>
          <div class="vp-field">
            <label for="vp-color">Couleur</label>
            <InputText
              id="vp-color"
              v-model="form.color"
              maxlength="40"
              placeholder="blanc, rouge…"
              required
            />
          </div>
          <div class="vp-field">
            <label for="vp-plate">Plaque</label>
            <InputText
              id="vp-plate"
              v-model="form.plate"
              maxlength="16"
              placeholder="AB123CD"
              class="vp-plate"
              required
            />
          </div>
        </div>

        <Message
          v-if="errorMsg"
          severity="error"
          :closable="false"
          class="vp-error"
        >
          {{ errorMsg }}
        </Message>
      </div>
    </div>

    <div class="vp-actions">
      <Button
        v-if="canGoBack"
        label="Précédent"
        icon="pi pi-arrow-left"
        severity="secondary"
        text
        :disabled="submitting"
        @click="emit('back')"
      />
      <span class="vp-spacer" />
      <Button
        label="Valider et continuer"
        icon="pi pi-check"
        :disabled="!canSubmit || analyzing"
        :loading="submitting"
        @click="submit"
      />
    </div>
  </div>
</template>

<style scoped>
.vp-step {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.vp-help {
  margin: 0;
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
}
.vp-picker {
  display: flex;
  justify-content: center;
  padding: 1.5rem 0;
}
.vp-preview-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.vp-preview {
  position: relative;
  display: flex;
  justify-content: center;
  background: var(--p-surface-100);
  border-radius: 8px;
  overflow: hidden;
}
.p-dark .vp-preview {
  background: var(--p-surface-800);
}
.vp-preview img {
  max-width: 100%;
  max-height: 260px;
  object-fit: contain;
  display: block;
}
.vp-retake {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
}
.vp-analyzing {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem;
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
  justify-content: center;
}
.vp-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.vp-confidence {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.vp-notes {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  line-height: 1.3;
}
.vp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem 0.75rem;
}
.vp-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.vp-field label {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}
.vp-plate {
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}
.vp-error {
  margin: 0;
}
.vp-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.vp-spacer {
  flex: 1;
}

@media (max-width: 480px) {
  .vp-grid {
    grid-template-columns: 1fr;
  }
}
</style>
