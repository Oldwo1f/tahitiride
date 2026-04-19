<script setup lang="ts">
import type { AdminCertification, AdminPaginated } from '~/types/admin'
import type { CertificationStatus, CertificationType } from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const admin = useAdminApi()
const fmt = useAdminFormat()
const toast = useToast()
const auth = useAuthStore()
const config = useRuntimeConfig()

const data = ref<AdminPaginated<AdminCertification> | null>(null)
const loading = ref(false)
const updating = ref<Set<string>>(new Set())
const page = ref(1)
const pageSize = 25

const statusFilter = ref<CertificationStatus | null>('pending_review')
const typeFilter = ref<CertificationType | null>(null)

const previewCert = ref<AdminCertification | null>(null)
const previewBlobUrl = ref<string | null>(null)
const previewLoading = ref(false)

const reviewOpen = ref(false)
const reviewCert = ref<AdminCertification | null>(null)
const reviewExpiry = ref<Date | null>(null)
const rejectReason = ref('')

const STATUS_OPTIONS: { label: string; value: CertificationStatus | null }[] = [
  { label: 'Toutes', value: null },
  { label: 'En attente OCR', value: 'pending_ocr' },
  { label: 'En attente revue', value: 'pending_review' },
  { label: 'Approuvées', value: 'approved' },
  { label: 'Rejetées', value: 'rejected' },
  { label: 'Expirées', value: 'expired' },
]

const TYPE_OPTIONS: { label: string; value: CertificationType | null }[] = [
  { label: 'Tous', value: null },
  { label: 'Permis', value: 'license' },
  { label: 'Vignette', value: 'insurance' },
]

async function load() {
  loading.value = true
  try {
    data.value = await admin.get<AdminPaginated<AdminCertification>>(
      '/certifications',
      {
        status: statusFilter.value,
        type: typeFilter.value,
        page: page.value,
        pageSize,
      },
    )
  } catch (e: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail:
        (e as { data?: { message?: string }; message?: string })?.data
          ?.message || 'Chargement impossible',
      life: 4000,
    })
  } finally {
    loading.value = false
  }
}

watch([statusFilter, typeFilter], () => {
  page.value = 1
  void load()
})

onMounted(load)

function onPage(event: { page: number; rows: number }) {
  page.value = event.page + 1
  void load()
}

function typeLabel(t: CertificationType): string {
  return t === 'license' ? 'Permis' : 'Vignette'
}

async function openPreview(cert: AdminCertification) {
  previewCert.value = cert
  previewLoading.value = true
  if (previewBlobUrl.value) {
    URL.revokeObjectURL(previewBlobUrl.value)
    previewBlobUrl.value = null
  }
  try {
    const url = `${config.public.apiBase || ''}${cert.file_url}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    previewBlobUrl.value = URL.createObjectURL(blob)
  } catch (e: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Aperçu indisponible',
      detail: (e as Error)?.message || 'Erreur',
      life: 3500,
    })
  } finally {
    previewLoading.value = false
  }
}

function closePreview() {
  if (previewBlobUrl.value) {
    URL.revokeObjectURL(previewBlobUrl.value)
    previewBlobUrl.value = null
  }
  previewCert.value = null
}

onBeforeUnmount(() => {
  if (previewBlobUrl.value) URL.revokeObjectURL(previewBlobUrl.value)
})

function startReview(cert: AdminCertification) {
  reviewCert.value = cert
  rejectReason.value = ''
  reviewExpiry.value = cert.expires_at
    ? new Date(`${cert.expires_at}T00:00:00`)
    : null
  reviewOpen.value = true
}

function isoOf(d: Date | null): string | undefined {
  if (!d) return undefined
  // Format as YYYY-MM-DD respecting the user's local timezone (the
  // backend stores DATE columns, not timestamps).
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function approve(cert: AdminCertification) {
  if (!cert) return
  updating.value.add(cert.id)
  try {
    const expiresIso = isoOf(reviewExpiry.value)
    const updated = await admin.post<AdminCertification>(
      `/certifications/${cert.id}/approve`,
      { expires_at: expiresIso },
    )
    if (data.value) {
      data.value.items = data.value.items.map((c) =>
        c.id === cert.id ? { ...c, ...updated } : c,
      )
    }
    toast.add({
      severity: 'success',
      summary: 'Certification approuvée',
      life: 2500,
    })
    reviewOpen.value = false
    closePreview()
  } catch (e: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail:
        (e as { data?: { message?: string } })?.data?.message ||
        'Approbation impossible',
      life: 4000,
    })
  } finally {
    updating.value.delete(cert.id)
  }
}

async function reject(cert: AdminCertification) {
  if (!cert) return
  if (!rejectReason.value.trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Motif requis',
      detail: 'Indiquez la raison du rejet pour informer le chauffeur.',
      life: 3000,
    })
    return
  }
  updating.value.add(cert.id)
  try {
    const updated = await admin.post<AdminCertification>(
      `/certifications/${cert.id}/reject`,
      { reason: rejectReason.value.trim() },
    )
    if (data.value) {
      data.value.items = data.value.items.map((c) =>
        c.id === cert.id ? { ...c, ...updated } : c,
      )
    }
    toast.add({
      severity: 'success',
      summary: 'Certification rejetée',
      life: 2500,
    })
    reviewOpen.value = false
    closePreview()
  } catch (e: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail:
        (e as { data?: { message?: string } })?.data?.message ||
        'Action impossible',
      life: 4000,
    })
  } finally {
    updating.value.delete(cert.id)
  }
}

function formatExpiry(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${iso}T00:00:00`))
  } catch {
    return '—'
  }
}

function rowClass(row: AdminCertification): string {
  if (row.status === 'pending_review' || row.status === 'pending_ocr')
    return 'row-pending'
  if (row.status === 'rejected') return 'row-rejected'
  if (row.status === 'expired') return 'row-expired'
  return ''
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Certifications</h1>
      <p class="tr-subtle">
        Validez ou rejetez les permis et vignettes en attente de revue.
      </p>
    </div>

    <div class="filters">
      <Select
        v-model="statusFilter"
        :options="STATUS_OPTIONS"
        option-label="label"
        option-value="value"
        placeholder="Statut"
        show-clear
      />
      <Select
        v-model="typeFilter"
        :options="TYPE_OPTIONS"
        option-label="label"
        option-value="value"
        placeholder="Type"
        show-clear
      />
      <Button
        icon="pi pi-refresh"
        severity="secondary"
        text
        :loading="loading"
        @click="load"
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
      :row-class="rowClass"
      @page="onPage"
    >
      <Column header="Soumis le">
        <template #body="{ data: row }">
          {{ fmt.formatDateShort(row.created_at) }}
        </template>
      </Column>
      <Column header="Type">
        <template #body="{ data: row }">
          <Tag
            :value="typeLabel(row.type)"
            :severity="row.type === 'license' ? 'info' : 'warn'"
          />
        </template>
      </Column>
      <Column header="Chauffeur">
        <template #body="{ data: row }">
          <div class="cell-user">
            <LetterAvatar
              :first-name="row.user.first_name"
              :last-name="row.user.last_name"
              :full-name="row.user.full_name"
            />
            <div class="cell-user-info">
              <NuxtLink :to="`/admin/users/${row.user.id}`" class="cell-user-name">
                {{ row.user.full_name }}
              </NuxtLink>
              <small class="tr-subtle">{{ row.user.email }}</small>
            </div>
          </div>
        </template>
      </Column>
      <Column header="Véhicule">
        <template #body="{ data: row }">
          <span v-if="row.vehicle">
            {{ row.vehicle.plate }}
            <small class="tr-subtle">
              · {{ row.vehicle.model }}
            </small>
          </span>
          <span v-else class="tr-subtle">—</span>
        </template>
      </Column>
      <Column header="OCR">
        <template #body="{ data: row }">
          <div v-if="row.ocr_extracted" class="ocr-cell">
            <div v-if="row.ocr_extracted.name" class="ocr-line">
              <i class="pi pi-user" /> {{ row.ocr_extracted.name }}
            </div>
            <div v-if="row.ocr_extracted.plate" class="ocr-line">
              <i class="pi pi-car" /> {{ row.ocr_extracted.plate }}
            </div>
            <div
              v-if="typeof row.ocr_extracted.confidence === 'number'"
              class="ocr-line"
            >
              <i class="pi pi-percentage" />
              Confiance {{ Math.round(row.ocr_extracted.confidence * 100) }} %
            </div>
            <div
              v-if="row.ocr_extracted.decision_notes"
              class="tr-subtle ocr-notes"
            >
              {{ row.ocr_extracted.decision_notes }}
            </div>
          </div>
          <span v-else class="tr-subtle">—</span>
        </template>
      </Column>
      <Column header="Validité">
        <template #body="{ data: row }">
          {{ formatExpiry(row.expires_at) }}
        </template>
      </Column>
      <Column header="Statut">
        <template #body="{ data: row }">
          <CertificationStatusBadge
            :status="row.status"
            :expires-at="row.expires_at"
          />
          <div
            v-if="row.rejection_reason"
            class="tr-subtle reject-reason"
            :title="row.rejection_reason"
          >
            {{ row.rejection_reason }}
          </div>
        </template>
      </Column>
      <Column header="Actions">
        <template #body="{ data: row }">
          <div class="row-actions">
            <Button
              icon="pi pi-eye"
              severity="secondary"
              text
              size="small"
              title="Aperçu"
              @click="openPreview(row)"
            />
            <Button
              v-if="row.status !== 'approved'"
              icon="pi pi-check"
              severity="success"
              size="small"
              text
              title="Approuver"
              :loading="updating.has(row.id)"
              @click="startReview(row)"
            />
          </div>
        </template>
      </Column>
      <template #empty>
        Aucune certification correspondante.
      </template>
    </DataTable>

    <Dialog
      :visible="!!previewCert"
      header="Aperçu du document"
      modal
      :style="{ width: '92vw', maxWidth: '720px' }"
      :closable="!previewLoading"
      @update:visible="(v: boolean) => !v && closePreview()"
    >
      <div v-if="previewLoading" class="tr-center" style="padding: 1rem;">
        <ProgressSpinner />
      </div>
      <div v-else-if="previewBlobUrl" class="preview-wrap">
        <img :src="previewBlobUrl" alt="Document" class="preview-img" />
        <div v-if="previewCert" class="preview-meta">
          <p>
            <strong>{{ typeLabel(previewCert.type) }}</strong>
            soumis le {{ fmt.formatDate(previewCert.created_at) }}
          </p>
          <p v-if="previewCert.user">
            Par {{ previewCert.user.full_name }} ({{ previewCert.user.email }})
          </p>
          <p v-if="previewCert.vehicle">
            Véhicule : {{ previewCert.vehicle.plate }} —
            {{ previewCert.vehicle.model }} ({{ previewCert.vehicle.color }})
          </p>
          <p v-if="previewCert.ocr_extracted?.decision_notes" class="tr-subtle">
            OCR : {{ previewCert.ocr_extracted.decision_notes }}
          </p>
        </div>
      </div>
      <template #footer>
        <Button
          v-if="previewCert"
          label="Approuver / Rejeter"
          icon="pi pi-pencil"
          @click="startReview(previewCert)"
        />
        <Button label="Fermer" text @click="closePreview" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="reviewOpen"
      header="Décision sur la certification"
      modal
      :style="{ width: '92vw', maxWidth: '460px' }"
    >
      <div v-if="reviewCert" class="review-form">
        <div class="review-info">
          <strong>{{ typeLabel(reviewCert.type) }}</strong>
          —
          {{ reviewCert.user.full_name }}
          <span v-if="reviewCert.vehicle"> · {{ reviewCert.vehicle.plate }}</span>
        </div>
        <div class="field">
          <label for="exp">Date de validité</label>
          <DatePicker
            id="exp"
            v-model="reviewExpiry"
            date-format="dd/mm/yy"
            show-icon
            :min-date="new Date()"
            fluid
          />
          <small class="tr-subtle">
            Date de fin de validité utilisée si vous approuvez.
          </small>
        </div>
        <div class="field">
          <label for="rej">Motif de rejet (si rejet)</label>
          <Textarea
            id="rej"
            v-model="rejectReason"
            rows="3"
            placeholder="Pièce illisible, nom différent, etc."
            maxlength="500"
            fluid
          />
        </div>
      </div>
      <template #footer>
        <Button
          label="Rejeter"
          icon="pi pi-times"
          severity="danger"
          :loading="updating.has(reviewCert?.id ?? '')"
          @click="reviewCert && reject(reviewCert)"
        />
        <Button
          label="Approuver"
          icon="pi pi-check"
          severity="success"
          :loading="updating.has(reviewCert?.id ?? '')"
          @click="reviewCert && approve(reviewCert)"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.page-header h1 {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
}
.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}
.cell-user {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.cell-user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.cell-user-name {
  font-weight: 600;
}
.ocr-cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.85rem;
}
.ocr-line {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
}
.ocr-notes {
  font-style: italic;
  font-size: 0.8rem;
}
.reject-reason {
  margin-top: 0.25rem;
  font-size: 0.8rem;
  font-style: italic;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  max-width: 200px;
}
.row-actions {
  display: flex;
  gap: 0.25rem;
}
.preview-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.preview-img {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  border-radius: 8px;
  background: var(--p-surface-100);
  align-self: center;
}
.p-dark .preview-img {
  background: var(--p-surface-800);
}
.preview-meta {
  font-size: 0.9rem;
}
.preview-meta p {
  margin: 0 0 0.25rem;
}
.review-form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.review-info {
  background: var(--p-surface-100);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
}
.p-dark .review-info {
  background: var(--p-surface-800);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
:deep(.row-pending) {
  background: rgba(56, 189, 248, 0.06);
}
:deep(.row-rejected) {
  background: rgba(239, 68, 68, 0.05);
}
:deep(.row-expired) {
  background: rgba(245, 158, 11, 0.05);
}
</style>
