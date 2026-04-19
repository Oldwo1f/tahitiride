<script setup lang="ts">
import type { AdminWalletDetail } from '~/types/admin'
import type { WalletTransactionKind } from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const admin = useAdminApi()
const fmt = useAdminFormat()
const route = useRoute()
const toast = useToast()
const confirm = useConfirm()

const userId = computed(() => route.params.userId as string)
const wallet = ref<AdminWalletDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const delta = ref<number | null>(null)
const reason = ref('')
const adjusting = ref(false)

const TX_LABEL: Record<WalletTransactionKind, string> = {
  initial: 'Crédit initial',
  credit: 'Crédit',
  debit: 'Débit',
  adjustment: 'Ajustement admin',
}
const TX_SEVERITY: Record<WalletTransactionKind, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
  initial: 'info',
  credit: 'success',
  debit: 'warn',
  adjustment: 'danger',
}

async function load() {
  loading.value = true
  error.value = null
  try {
    wallet.value = await admin.get<AdminWalletDetail>(
      `/wallets/${userId.value}`,
    )
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

const previewBalance = computed(() => {
  if (!wallet.value || delta.value === null) return null
  return wallet.value.balance_xpf + delta.value
})
const previewIsNegative = computed(
  () => previewBalance.value !== null && previewBalance.value < 0,
)

function submitAdjust() {
  if (!wallet.value) return
  if (delta.value === null || delta.value === 0) {
    toast.add({
      severity: 'warn',
      summary: 'Saisissez un delta non nul',
      life: 3000,
    })
    return
  }
  if (reason.value.trim().length < 3) {
    toast.add({
      severity: 'warn',
      summary: 'Indiquez un motif (min. 3 caractères)',
      life: 3000,
    })
    return
  }
  if (previewIsNegative.value) {
    toast.add({
      severity: 'error',
      summary: 'Solde final négatif interdit',
      life: 3000,
    })
    return
  }
  const sign = (delta.value ?? 0) > 0 ? '+' : ''
  confirm.require({
    header: 'Confirmer l’ajustement',
    message: `${sign}${delta.value} XPF sur ${wallet.value.user.email} ?\n\n« ${reason.value} »`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Appliquer',
    acceptClass: 'p-button-warning',
    rejectLabel: 'Annuler',
    accept: async () => {
      adjusting.value = true
      try {
        await admin.post(`/wallets/${userId.value}/adjust`, {
          deltaXpf: delta.value,
          reason: reason.value.trim(),
        })
        toast.add({
          severity: 'success',
          summary: 'Ajustement appliqué',
          life: 2500,
        })
        delta.value = null
        reason.value = ''
        await load()
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
        adjusting.value = false
      }
    },
  })
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <NuxtLink to="/admin/wallets" class="back-link">
        <i class="pi pi-arrow-left" /> Wallets
      </NuxtLink>
    </div>

    <Message v-if="error" severity="error" :closable="false">
      {{ error }}
    </Message>

    <div v-if="loading && !wallet" class="loading">
      <ProgressSpinner />
    </div>

    <template v-else-if="wallet">
      <Card>
        <template #title>{{ wallet.user.full_name }}</template>
        <template #subtitle>{{ wallet.user.email }}</template>
        <template #content>
          <div class="balance-block">
            <div class="balance-amount">
              {{ fmt.formatXpf(wallet.balance_xpf) }}
            </div>
            <NuxtLink :to="`/admin/users/${wallet.user.id}`" class="link">
              Profil utilisateur →
            </NuxtLink>
          </div>
        </template>
      </Card>

      <Card>
        <template #title>Ajustement de solde</template>
        <template #content>
          <div class="adjust-form">
            <div class="adjust-field">
              <label>Delta (XPF)</label>
              <InputNumber
                v-model="delta"
                :step="100"
                show-buttons
                button-layout="horizontal"
                :input-style="{ textAlign: 'right' }"
              />
              <small class="hint">
                Positif pour créditer, négatif pour débiter.
              </small>
            </div>
            <div class="adjust-field flex-2">
              <label>Motif</label>
              <Textarea
                v-model="reason"
                rows="2"
                placeholder="Geste commercial, correction d’erreur..."
              />
            </div>
            <div class="adjust-field">
              <div v-if="previewBalance !== null" class="preview">
                Nouveau solde&nbsp;:
                <strong :class="{ 'preview-bad': previewIsNegative }">
                  {{ fmt.formatXpf(previewBalance) }}
                </strong>
              </div>
              <Button
                label="Appliquer"
                icon="pi pi-check"
                :loading="adjusting"
                :disabled="
                  !delta || !reason.trim() || previewIsNegative
                "
                @click="submitAdjust"
              />
            </div>
          </div>
        </template>
      </Card>

      <Card>
        <template #title>
          Historique des transactions ({{ wallet.transactions.length }})
        </template>
        <template #content>
          <DataTable
            :value="wallet.transactions"
            data-key="id"
            paginator
            :rows="20"
            scrollable
          >
            <Column header="Date">
              <template #body="{ data }">
                {{ fmt.formatDate(data.created_at) }}
              </template>
            </Column>
            <Column header="Type">
              <template #body="{ data }">
                <Tag
                  :value="TX_LABEL[data.type as WalletTransactionKind] ?? data.type"
                  :severity="TX_SEVERITY[data.type as WalletTransactionKind] ?? 'secondary'"
                />
              </template>
            </Column>
            <Column header="Montant">
              <template #body="{ data }">
                <span :class="data.amount_xpf < 0 ? 'amount-neg' : 'amount-pos'">
                  {{ data.amount_xpf > 0 ? '+' : '' }}{{ fmt.formatXpf(data.amount_xpf) }}
                </span>
              </template>
            </Column>
            <Column field="trip_id" header="Trajet">
              <template #body="{ data }">
                <NuxtLink v-if="data.trip_id" :to="`/admin/trips/${data.trip_id}`">
                  Voir
                </NuxtLink>
                <span v-else>—</span>
              </template>
            </Column>
            <Column field="reason" header="Motif">
              <template #body="{ data }">{{ data.reason || '—' }}</template>
            </Column>
            <template #empty>Aucune transaction.</template>
          </DataTable>
        </template>
      </Card>
    </template>

    <ConfirmDialog />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
.balance-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.balance-amount {
  font-size: 2rem;
  font-weight: 700;
  color: var(--p-primary-color);
}
.link {
  color: var(--p-text-muted-color);
  text-decoration: none;
  font-size: 0.9rem;
}
.adjust-form {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  gap: 1rem;
  align-items: end;
}
@media (max-width: 800px) {
  .adjust-form {
    grid-template-columns: 1fr;
  }
}
.adjust-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.adjust-field label {
  font-weight: 600;
  font-size: 0.9rem;
}
.hint {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}
.preview {
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}
.preview-bad {
  color: var(--p-red-500);
}
.amount-pos {
  color: var(--p-green-600);
  font-weight: 600;
}
.amount-neg {
  color: var(--p-red-500);
  font-weight: 600;
}
</style>
