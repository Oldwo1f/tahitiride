<script setup lang="ts">
import type { Certification, CertificationType } from '~/types/api'

/**
 * Inline (non-dialog) variant of `CertificationUploadDialog` used as a
 * step inside the driver onboarding / add-vehicle wizards. Same upload
 * + OCR flow but rendered straight into the stepper card.
 *
 * Emits `submitted(cert)` once the backend has accepted the file. The
 * wizard uses that to unlock the "next" button (any status that is not
 * `rejected` is considered "good enough" to keep moving forward — admin
 * review can still happen asynchronously).
 */
const props = defineProps<{
  type: CertificationType
  /** Required for `type='insurance'`. */
  vehicleId?: string | null
  /** Optional context line (e.g. plate of the vehicle being insured). */
  contextLabel?: string | null
  canGoBack?: boolean
}>()

const emit = defineEmits<{
  (e: 'submitted', cert: Certification): void
  (e: 'next'): void
  (e: 'back'): void
}>()

const api = useApi()
const toast = useToast()

const fileInput = ref<HTMLInputElement | null>(null)
const fileMeta = ref<{ name: string; size: number } | null>(null)
const previewUrl = ref<string | null>(null)
const submitting = ref(false)
const errorMsg = ref<string | null>(null)
const result = ref<Certification | null>(null)

const HELP: Record<CertificationType, string> = {
  license:
    'Cadrez le recto du permis. Le nom doit être lisible et identique à celui de votre profil.',
  insurance:
    "Cadrez la vignette ou l'attestation d'assurance. La plaque et la date de fin de validité doivent être visibles.",
}

const canProceed = computed(() => {
  // Reject = user must re-upload before moving on. Anything else
  // (approved, pending_review, pending_ocr) is acceptable to continue.
  return !!result.value && result.value.status !== 'rejected'
})

function pickFile() {
  fileInput.value?.click()
}

function reset() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
  fileMeta.value = null
  result.value = null
  errorMsg.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 8 * 1024 * 1024) {
    errorMsg.value = 'Fichier trop volumineux (8 Mo maximum)'
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
  result.value = null
}

async function submit() {
  const file = fileInput.value?.files?.[0]
  if (!file) {
    errorMsg.value = 'Sélectionnez un fichier'
    return
  }
  if (props.type === 'insurance' && !props.vehicleId) {
    errorMsg.value = 'Aucun véhicule sélectionné'
    return
  }
  submitting.value = true
  errorMsg.value = null
  try {
    const form = new FormData()
    form.append('file', file)
    const path =
      props.type === 'license'
        ? '/api/certifications/license'
        : `/api/certifications/vehicle/${props.vehicleId}/insurance`
    const cert = await api<Certification>(path, {
      method: 'POST',
      body: form,
    })
    result.value = cert
    emit('submitted', cert)
    if (cert.status === 'approved') {
      toast.add({
        severity: 'success',
        summary: 'Document validé',
        detail: 'Votre certification est active.',
        life: 3500,
      })
    } else if (cert.status === 'pending_review' || cert.status === 'pending_ocr') {
      toast.add({
        severity: 'info',
        summary: 'Document reçu',
        detail: 'Validation manuelle en cours par un administrateur.',
        life: 4500,
      })
    } else if (cert.status === 'rejected') {
      toast.add({
        severity: 'warn',
        summary: 'Document rejeté',
        detail: cert.rejection_reason ?? 'Motif non précisé',
        life: 5000,
      })
    }
  } catch (e: unknown) {
    const data = (e as { data?: { message?: string | string[] } })?.data
    errorMsg.value =
      (Array.isArray(data?.message) ? data.message.join(', ') : data?.message) ||
      (e as { message?: string })?.message ||
      'Échec du téléversement'
  } finally {
    submitting.value = false
  }
}

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <div class="cert-step">
    <p class="cert-help">
      {{ HELP[type] }}
    </p>
    <div v-if="contextLabel" class="cert-context">
      <i class="pi pi-info-circle" /> {{ contextLabel }}
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      capture="environment"
      hidden
      @change="onFileChange"
    >

    <div v-if="!result" class="cert-picker">
      <Button
        :icon="fileMeta ? 'pi pi-refresh' : 'pi pi-camera'"
        :label="fileMeta ? 'Changer la photo' : 'Prendre ou choisir une photo'"
        :severity="fileMeta ? 'secondary' : undefined"
        :size="fileMeta ? 'small' : 'large'"
        @click="pickFile"
      />
      <div v-if="previewUrl" class="cert-preview">
        <img :src="previewUrl" alt="Aperçu" >
        <div class="cert-meta">
          {{ fileMeta?.name }} ·
          {{ fileMeta ? Math.round(fileMeta.size / 1024) : 0 }} Ko
        </div>
      </div>
      <Message
        v-if="errorMsg"
        severity="error"
        :closable="false"
      >{{ errorMsg }}</Message>
      <div class="cert-actions">
        <Button
          v-if="canGoBack"
          label="Précédent"
          icon="pi pi-arrow-left"
          severity="secondary"
          text
          :disabled="submitting"
          @click="emit('back')"
        />
        <span class="cert-spacer" />
        <Button
          :label="submitting ? 'Analyse en cours…' : 'Envoyer'"
          icon="pi pi-upload"
          :disabled="!fileMeta"
          :loading="submitting"
          @click="submit"
        />
      </div>
    </div>

    <div v-else class="cert-result">
      <CertificationStatusBadge
        :status="result.status"
        :expires-at="result.expires_at"
      />
      <div v-if="result.ocr_extracted?.decision_notes" class="cert-notes">
        {{ result.ocr_extracted.decision_notes }}
      </div>
      <ul v-if="result.ocr_extracted" class="cert-fields">
        <li v-if="result.ocr_extracted.name">
          <strong>Nom détecté :</strong> {{ result.ocr_extracted.name }}
        </li>
        <li v-if="result.ocr_extracted.plate">
          <strong>Plaque détectée :</strong> {{ result.ocr_extracted.plate }}
        </li>
        <li v-if="result.expires_at">
          <strong>Validité jusqu'au :</strong>
          {{
            new Intl.DateTimeFormat('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            }).format(new Date(`${result.expires_at}T00:00:00`))
          }}
        </li>
        <li v-if="typeof result.ocr_extracted.confidence === 'number'">
          <strong>Confiance OCR :</strong>
          {{ Math.round(result.ocr_extracted.confidence * 100) }} %
        </li>
      </ul>
      <Message
        v-if="result.status === 'rejected'"
        severity="warn"
        :closable="false"
      >
        Le document a été rejeté. Recommencez avec une photo plus nette.
      </Message>
      <div class="cert-actions">
        <Button
          v-if="canGoBack"
          label="Précédent"
          icon="pi pi-arrow-left"
          severity="secondary"
          text
          @click="emit('back')"
        />
        <Button
          v-if="result.status === 'rejected'"
          label="Reprendre"
          icon="pi pi-refresh"
          severity="secondary"
          @click="reset"
        />
        <span class="cert-spacer" />
        <Button
          label="Continuer"
          icon="pi pi-arrow-right"
          icon-pos="right"
          :disabled="!canProceed"
          @click="emit('next')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.cert-step {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.cert-help {
  margin: 0;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}
.cert-context {
  background: var(--p-surface-100);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.p-dark .cert-context {
  background: var(--p-surface-800);
}
.cert-picker,
.cert-result {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.cert-preview {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.cert-preview img {
  max-width: 100%;
  max-height: 240px;
  object-fit: contain;
  border-radius: 6px;
  background: var(--p-surface-100);
}
.p-dark .cert-preview img {
  background: var(--p-surface-800);
}
.cert-meta {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}
.cert-fields {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
}
.cert-notes {
  background: var(--p-surface-100);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
}
.p-dark .cert-notes {
  background: var(--p-surface-800);
}
.cert-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}
.cert-spacer {
  flex: 1;
}
</style>
