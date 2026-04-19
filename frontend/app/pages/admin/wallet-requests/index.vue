<script setup lang="ts">
import type {
  AdminPaginated,
  AdminWalletRequestItem,
} from '~/types/admin'
import type { WalletRequestStatus, WalletRequestType } from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const adminWr = useAdminWalletRequests()
const fmt = useAdminFormat()
const toast = useToast()
const confirm = useConfirm()
const socket = useSocket()

const statusFilter = ref<WalletRequestStatus | null>('pending')
const typeFilter = ref<WalletRequestType | null>(null)
const page = ref(1)
const pageSize = 25

const data = ref<AdminPaginated<AdminWalletRequestItem> | null>(null)
const loading = ref(false)
const updating = ref<Set<string>>(new Set())

const reviewOpen = ref(false)
const reviewItem = ref<AdminWalletRequestItem | null>(null)
const adminNote = ref('')

const STATUS_OPTIONS: { label: string; value: WalletRequestStatus | null }[] = [
  { label: 'Toutes', value: null },
  { label: 'En attente', value: 'pending' },
  { label: 'Validées', value: 'approved' },
  { label: 'Rejetées', value: 'rejected' },
  { label: 'Annulées', value: 'cancelled' },
]

const TYPE_OPTIONS: { label: string; value: WalletRequestType | null }[] = [
  { label: 'Tous', value: null },
  { label: 'Dépôts', value: 'deposit' },
  { label: 'Retraits', value: 'payout' },
]

const STATUS_LABEL: Record<WalletRequestStatus, string> = {
  pending: 'En attente',
  approved: 'Validée',
  rejected: 'Rejetée',
  cancelled: 'Annulée',
}

function statusSeverity(
  s: WalletRequestStatus,
): 'success' | 'warn' | 'info' | 'danger' | 'secondary' {
  switch (s) {
    case 'approved':
      return 'success'
    case 'pending':
      return 'info'
    case 'rejected':
      return 'danger'
    case 'cancelled':
      return 'secondary'
    default:
      return 'secondary'
  }
}

function typeLabel(t: WalletRequestType): string {
  return t === 'deposit' ? 'Dépôt' : 'Retrait'
}
function typeSeverity(t: WalletRequestType): 'success' | 'warn' {
  return t === 'deposit' ? 'success' : 'warn'
}

async function load() {
  loading.value = true
  try {
    data.value = await adminWr.list({
      status: statusFilter.value,
      type: typeFilter.value,
      page: page.value,
      pageSize,
    })
  } catch (e: unknown) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail:
        (e as { data?: { message?: string } })?.data?.message ||
        'Chargement impossible',
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

onMounted(() => {
  void load()
  void adminWr.refreshPendingCount()
})

function onPage(event: { page: number; rows: number }) {
  page.value = event.page + 1
  void load()
}

function startReview(item: AdminWalletRequestItem) {
  reviewItem.value = item
  adminNote.value = ''
  reviewOpen.value = true
}

function applyUpdated(updated: AdminWalletRequestItem) {
  if (!data.value) return
  if (statusFilter.value && updated.status !== statusFilter.value) {
    data.value.items = data.value.items.filter((x) => x.id !== updated.id)
    data.value.total = Math.max(0, data.value.total - 1)
    return
  }
  data.value.items = data.value.items.map((x) =>
    x.id === updated.id ? updated : x,
  )
}

async function approve(item: AdminWalletRequestItem) {
  if (item.type === 'payout') {
    confirm.require({
      header: 'Confirmer le virement',
      message: `Avez-vous bien viré ${fmt.formatXpf(item.amount_xpf)} à ${item.user_full_name} (${item.iban}) ? Le wallet sera débité immédiatement.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Oui, débiter',
      rejectLabel: 'Annuler',
      acceptClass: 'p-button-success',
      accept: () => doApprove(item),
    })
    return
  }
  await doApprove(item)
}

async function doApprove(item: AdminWalletRequestItem) {
  updating.value.add(item.id)
  try {
    const updated = await adminWr.approve(item.id, {
      admin_note: adminNote.value.trim() || undefined,
    })
    applyUpdated(updated)
    toast.add({
      severity: 'success',
      summary:
        item.type === 'deposit' ? 'Dépôt crédité' : 'Retrait débité',
      detail: `${item.user_full_name} · ${fmt.formatXpf(item.amount_xpf)}`,
      life: 3000,
    })
    reviewOpen.value = false
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
    updating.value.delete(item.id)
  }
}

async function reject(item: AdminWalletRequestItem) {
  if (!adminNote.value.trim() || adminNote.value.trim().length < 3) {
    toast.add({
      severity: 'warn',
      summary: 'Motif requis',
      detail: 'Indiquez la raison du rejet (3 caractères minimum).',
      life: 3000,
    })
    return
  }
  updating.value.add(item.id)
  try {
    const updated = await adminWr.reject(item.id, {
      admin_note: adminNote.value.trim(),
    })
    applyUpdated(updated)
    toast.add({
      severity: 'info',
      summary: 'Demande rejetée',
      life: 2500,
    })
    reviewOpen.value = false
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
    updating.value.delete(item.id)
  }
}

function copyIban(value: string | null) {
  if (!value) return
  void navigator.clipboard?.writeText(value).then(() => {
    toast.add({
      severity: 'success',
      summary: 'IBAN copié',
      detail: value,
      life: 2000,
    })
  })
}

function rowClass(row: AdminWalletRequestItem): string {
  if (row.status === 'pending') return 'row-pending'
  if (row.status === 'rejected') return 'row-rejected'
  return ''
}

function onLiveUpdated(updated: AdminWalletRequestItem) {
  applyUpdated(updated)
}
function onLiveNew() {
  // A new row may match the current filters; refresh to be sure.
  void load()
}

if (import.meta.client) {
  socket.on('wallet:request:updated', onLiveUpdated)
  socket.on('wallet:request:new', onLiveNew)
  onScopeDispose(() => {
    socket.off('wallet:request:updated', onLiveUpdated)
    socket.off('wallet:request:new', onLiveNew)
  })
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>
        Demandes wallet
        <Badge
          v-if="adminWr.pendingCount.value > 0"
          :value="adminWr.pendingCount.value"
          severity="warn"
        />
      </h1>
      <p class="tr-subtle">
        Approuvez les dépôts une fois le virement reçu, et les retraits
        après avoir effectué le virement vers le conducteur.
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
      <Column header="Date">
        <template #body="{ data: row }">
          {{ fmt.formatDate(row.created_at) }}
        </template>
      </Column>
      <Column header="Type">
        <template #body="{ data: row }">
          <Tag
            :value="typeLabel(row.type)"
            :severity="typeSeverity(row.type)"
          />
        </template>
      </Column>
      <Column header="Utilisateur">
        <template #body="{ data: row }">
          <NuxtLink :to="`/admin/wallets/${row.user_id}`" class="user-link">
            <div class="user-name">{{ row.user_full_name }}</div>
            <small class="tr-subtle">{{ row.user_email }}</small>
          </NuxtLink>
        </template>
      </Column>
      <Column header="Montant">
        <template #body="{ data: row }">
          <span :class="row.type === 'deposit' ? 'amount-pos' : 'amount-neg'">
            {{ row.type === 'deposit' ? '+' : '-' }}{{ fmt.formatXpf(row.amount_xpf) }}
          </span>
        </template>
      </Column>
      <Column header="Solde actuel">
        <template #body="{ data: row }">
          <span class="balance">{{ fmt.formatXpf(row.balance_xpf) }}</span>
          <small
            v-if="
              row.status === 'pending' &&
                row.type === 'payout' &&
                row.balance_xpf < row.amount_xpf
            "
            class="balance-warn"
          >
            <i class="pi pi-exclamation-triangle" /> insuffisant
          </small>
        </template>
      </Column>
      <Column header="Détails">
        <template #body="{ data: row }">
          <div class="details">
            <div v-if="row.type === 'payout'" class="iban-row">
              <code class="iban">{{ row.iban }}</code>
              <Button
                icon="pi pi-copy"
                text
                size="small"
                severity="secondary"
                title="Copier l'IBAN"
                @click="copyIban(row.iban)"
              />
            </div>
            <div v-if="row.type === 'payout'" class="holder">
              {{ row.account_holder_name }}
            </div>
            <div v-if="row.user_note" class="user-note">
              <i class="pi pi-comment" /> {{ row.user_note }}
            </div>
          </div>
        </template>
      </Column>
      <Column header="Statut">
        <template #body="{ data: row }">
          <Tag
            :value="STATUS_LABEL[row.status as WalletRequestStatus]"
            :severity="statusSeverity(row.status)"
          />
          <div
            v-if="row.admin_note"
            class="admin-note tr-subtle"
            :title="row.admin_note"
          >
            {{ row.admin_note }}
          </div>
          <div
            v-if="row.processed_at"
            class="tr-subtle processed-at"
          >
            {{ fmt.formatDateShort(row.processed_at) }}
            <span v-if="row.processed_by_email">
              · {{ row.processed_by_email }}
            </span>
          </div>
        </template>
      </Column>
      <Column header="Actions">
        <template #body="{ data: row }">
          <div v-if="row.status === 'pending'" class="row-actions">
            <Button
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
      <template #empty>Aucune demande.</template>
    </DataTable>

    <Dialog
      v-model:visible="reviewOpen"
      header="Décision sur la demande"
      modal
      :style="{ width: '92vw', maxWidth: '480px' }"
    >
      <div v-if="reviewItem" class="review">
        <div class="review-info">
          <div>
            <Tag
              :value="typeLabel(reviewItem.type)"
              :severity="typeSeverity(reviewItem.type)"
            />
            <strong class="review-amount">
              {{ fmt.formatXpf(reviewItem.amount_xpf) }}
            </strong>
          </div>
          <div class="review-user">
            {{ reviewItem.user_full_name }}
            <small class="tr-subtle">· {{ reviewItem.user_email }}</small>
          </div>
          <div v-if="reviewItem.type === 'payout'" class="review-iban">
            <i class="pi pi-credit-card" />
            {{ reviewItem.iban }} — {{ reviewItem.account_holder_name }}
          </div>
          <div
            v-if="reviewItem.user_note"
            class="review-note"
          >
            <i class="pi pi-comment" /> « {{ reviewItem.user_note }} »
          </div>
          <div class="review-balance tr-subtle">
            Solde actuel : {{ fmt.formatXpf(reviewItem.balance_xpf) }}
            <span
              v-if="
                reviewItem.type === 'payout' &&
                  reviewItem.balance_xpf < reviewItem.amount_xpf
              "
              class="balance-warn"
            >
              <i class="pi pi-exclamation-triangle" /> insuffisant
            </span>
          </div>
        </div>

        <div class="field">
          <label for="adn">
            Note admin
            <small class="tr-subtle">
              (obligatoire en cas de rejet, optionnelle en cas
              d’approbation — visible par l’utilisateur)
            </small>
          </label>
          <Textarea
            id="adn"
            v-model="adminNote"
            rows="3"
            placeholder="Réf. virement, motif du rejet, etc."
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
          :loading="updating.has(reviewItem?.id ?? '')"
          @click="reviewItem && reject(reviewItem)"
        />
        <Button
          label="Approuver"
          icon="pi pi-check"
          severity="success"
          :loading="updating.has(reviewItem?.id ?? '')"
          :disabled="
            reviewItem?.type === 'payout' &&
              (reviewItem?.balance_xpf ?? 0) < (reviewItem?.amount_xpf ?? 0)
          "
          @click="reviewItem && approve(reviewItem)"
        />
      </template>
    </Dialog>

    <ConfirmDialog />
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
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.page-header p {
  margin: 0;
  font-size: 0.9rem;
}
.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}
.user-link {
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
}
.user-name {
  font-weight: 600;
}
.amount-pos {
  color: var(--p-green-600);
  font-weight: 600;
}
.amount-neg {
  color: var(--p-red-500);
  font-weight: 600;
}
.balance {
  font-weight: 600;
}
.balance-warn {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  color: var(--p-amber-600);
  font-size: 0.8rem;
  margin-left: 0.4rem;
}
.details {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.85rem;
}
.iban-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.iban {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: var(--p-surface-100);
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  font-size: 0.8rem;
  letter-spacing: 0.04em;
}
.p-dark .iban {
  background: var(--p-surface-800);
}
.holder {
  color: var(--p-text-muted-color);
}
.user-note {
  display: flex;
  gap: 0.3rem;
  align-items: flex-start;
  font-style: italic;
  color: var(--p-text-muted-color);
}
.admin-note {
  margin-top: 0.25rem;
  font-size: 0.8rem;
  font-style: italic;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  max-width: 220px;
}
.processed-at {
  margin-top: 0.2rem;
  font-size: 0.75rem;
}
.row-actions {
  display: flex;
  gap: 0.25rem;
}
:deep(.row-pending) {
  background: rgba(56, 189, 248, 0.06);
}
:deep(.row-rejected) {
  background: rgba(239, 68, 68, 0.05);
}
.review {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.review-info {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background: var(--p-surface-100);
  padding: 0.75rem 1rem;
  border-radius: 8px;
}
.p-dark .review-info {
  background: var(--p-surface-800);
}
.review-amount {
  margin-left: 0.5rem;
  font-size: 1.1rem;
}
.review-user {
  font-weight: 500;
}
.review-iban {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.04em;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.review-note {
  font-style: italic;
  color: var(--p-text-muted-color);
}
.review-balance {
  font-size: 0.85rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.field label {
  font-size: 0.9rem;
  font-weight: 500;
}
</style>
