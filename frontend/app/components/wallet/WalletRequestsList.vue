<script setup lang="ts">
import type { WalletRequestDto, WalletRequestStatus } from '~/types/api'

const props = defineProps<{
  requests: WalletRequestDto[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'cancel', requestId: string): void
}>()

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

function typeLabel(t: WalletRequestDto['type']): string {
  return t === 'deposit' ? 'Dépôt' : 'Retrait'
}

function typeIcon(t: WalletRequestDto['type']): string {
  return t === 'deposit' ? 'pi pi-arrow-down-left' : 'pi pi-arrow-up-right'
}

function fmtAmount(t: WalletRequestDto['type'], n: number): string {
  const sign = t === 'deposit' ? '+' : '-'
  return `${sign}${n.toLocaleString('fr-FR')} XPF`
}

function fmtDate(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d)
}

void props
</script>

<template>
  <DataTable
    :value="requests"
    :loading="loading"
    data-key="id"
    class="p-datatable-sm"
    :empty-message="'Aucune demande'"
    striped-rows
  >
    <Column header="Date">
      <template #body="{ data }">
        {{ fmtDate(data.created_at) }}
      </template>
    </Column>
    <Column header="Type">
      <template #body="{ data }">
        <span class="wr-type">
          <i :class="typeIcon(data.type)" />
          {{ typeLabel(data.type) }}
        </span>
      </template>
    </Column>
    <Column header="Montant">
      <template #body="{ data }">
        <span :class="data.type === 'deposit' ? 'wr-credit' : 'wr-debit'">
          {{ fmtAmount(data.type, data.amount_xpf) }}
        </span>
      </template>
    </Column>
    <Column header="Statut">
      <template #body="{ data }">
        <Tag
          :value="STATUS_LABEL[data.status as WalletRequestStatus]"
          :severity="statusSeverity(data.status)"
        />
      </template>
    </Column>
    <Column header="Détail">
      <template #body="{ data }">
        <div class="wr-detail">
          <div v-if="data.type === 'payout' && data.iban" class="wr-iban">
            {{ data.iban }}
          </div>
          <div v-if="data.admin_note" class="wr-admin-note">
            <i class="pi pi-info-circle" /> {{ data.admin_note }}
          </div>
          <div v-if="data.processed_at" class="wr-processed">
            Traitée le {{ fmtDate(data.processed_at) }}
          </div>
        </div>
      </template>
    </Column>
    <Column header="">
      <template #body="{ data }">
        <Button
          v-if="data.status === 'pending'"
          icon="pi pi-times"
          severity="secondary"
          text
          size="small"
          title="Annuler la demande"
          @click="emit('cancel', data.id)"
        />
      </template>
    </Column>
  </DataTable>
</template>

<style scoped>
.wr-type {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.wr-credit {
  color: var(--p-green-500);
  font-weight: 600;
}
.wr-debit {
  color: var(--p-red-500);
  font-weight: 600;
}
.wr-detail {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}
.wr-iban {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.04em;
  color: var(--p-text-color);
}
.wr-admin-note {
  display: flex;
  gap: 0.35rem;
  align-items: flex-start;
}
.wr-processed {
  font-style: italic;
}
</style>
