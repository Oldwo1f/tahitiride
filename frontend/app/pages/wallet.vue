<script setup lang="ts">
import type {
  WalletBalance,
  WalletRequestDto,
  WalletTransactionDto,
} from '~/types/api'

definePageMeta({
  middleware: ['auth'],
})

const api = useApi()
const auth = useAuthStore()
const socket = useSocket()
const wallet = useWalletRequests()

const balance = ref<number | null>(null)
const transactions = ref<WalletTransactionDto[]>([])
const loading = ref(true)
const errorMsg = ref<string | null>(null)

const depositOpen = ref(false)
const payoutOpen = ref(false)

async function loadWallet() {
  loading.value = true
  errorMsg.value = null
  try {
    const [bal, txs] = await Promise.all([
      api<WalletBalance>('/api/wallet'),
      api<WalletTransactionDto[]>('/api/wallet/transactions?limit=50'),
    ])
    balance.value = bal.balance_xpf
    transactions.value = txs
  } catch (e: unknown) {
    errorMsg.value =
      (e as { data?: { message?: string } })?.data?.message ||
      (e as { message?: string })?.message ||
      'Erreur de chargement'
  } finally {
    loading.value = false
  }
}

async function loadAll() {
  await Promise.all([loadWallet(), wallet.load()])
}

function typeLabel(t: WalletTransactionDto['type']): string {
  if (t === 'credit') return 'Crédit'
  if (t === 'debit') return 'Débit'
  return 'Initial'
}

function typeSeverity(
  t: WalletTransactionDto['type'],
): 'success' | 'warn' | 'info' {
  if (t === 'credit') return 'success'
  if (t === 'debit') return 'warn'
  return 'info'
}

const minPayoutBalance = computed<number>(
  () => wallet.limits.value?.payout_min_balance_xpf ?? 1000,
)

const canRequestPayout = computed<boolean>(() => {
  if (!auth.isDriver) return false
  if (balance.value === null) return false
  return balance.value >= minPayoutBalance.value
})

const payoutTooltip = computed<string | undefined>(() => {
  if (!auth.isDriver) return undefined
  if (balance.value === null) return undefined
  if (balance.value < minPayoutBalance.value) {
    return `Solde minimum requis : ${minPayoutBalance.value.toLocaleString('fr-FR')} XPF`
  }
  return undefined
})

const pendingRequests = computed<WalletRequestDto[]>(() =>
  wallet.requests.value.filter((r) => r.status === 'pending'),
)
const recentRequests = computed<WalletRequestDto[]>(() =>
  wallet.requests.value.filter((r) => r.status !== 'pending').slice(0, 10),
)

function onCancelRequest(requestId: string) {
  void wallet.cancel(requestId).catch(() => {
    /* surfaced via toast in composable on next refresh */
  })
}

function onWalletRequestUpdated(req: WalletRequestDto): void {
  if (!auth.user || req.user_id !== auth.user.id) return
  // Approval mutates the wallet balance/history; refresh both.
  if (req.status === 'approved') {
    void loadWallet()
  }
}

onMounted(loadAll)

if (import.meta.client) {
  socket.on('wallet:request:updated', onWalletRequestUpdated)
  onScopeDispose(() => {
    socket.off('wallet:request:updated', onWalletRequestUpdated)
  })
}
</script>

<template>
  <div class="tr-stack">
    <TopBar title="Portefeuille" />

    <Card v-if="loading" class="tr-center">
      <template #content><ProgressSpinner /></template>
    </Card>
    <Message v-else-if="errorMsg" severity="error">{{ errorMsg }}</Message>

    <template v-else>
      <Card>
        <template #content>
          <div class="balance">
            <div class="tr-subtle">Solde</div>
            <div class="amount">
              {{ (balance ?? 0).toLocaleString('fr-FR') }} XPF
            </div>
          </div>
          <div class="actions">
            <Button
              icon="pi pi-plus"
              label="Ajouter des fonds"
              severity="primary"
              @click="depositOpen = true"
            />
            <span
              v-if="auth.isDriver"
              v-tooltip.top="payoutTooltip"
              class="payout-wrap"
            >
              <Button
                icon="pi pi-send"
                label="Demander un virement"
                severity="secondary"
                :disabled="!canRequestPayout"
                @click="payoutOpen = true"
              />
            </span>
          </div>
          <p
            v-if="auth.isDriver && balance !== null && balance < minPayoutBalance"
            class="payout-hint tr-subtle"
          >
            Solde minimum requis pour demander un virement :
            <strong>
              {{ minPayoutBalance.toLocaleString('fr-FR') }} XPF
            </strong>
          </p>
        </template>
      </Card>

      <Card v-if="pendingRequests.length > 0">
        <template #title>
          Demandes en cours ({{ pendingRequests.length }})
        </template>
        <template #content>
          <WalletRequestsList
            :requests="pendingRequests"
            @cancel="onCancelRequest"
          />
        </template>
      </Card>

      <Card v-if="recentRequests.length > 0">
        <template #title>Mes demandes traitées</template>
        <template #content>
          <WalletRequestsList :requests="recentRequests" />
        </template>
      </Card>

      <Card>
        <template #title>Historique</template>
        <template #content>
          <DataTable
            :value="transactions"
            data-key="id"
            class="p-datatable-sm"
            :empty-message="'Aucune transaction'"
          >
            <Column header="Date">
              <template #body="{ data }">
                {{ new Date(data.created_at).toLocaleString() }}
              </template>
            </Column>
            <Column header="Type">
              <template #body="{ data }">
                <Tag :value="typeLabel(data.type)" :severity="typeSeverity(data.type)" />
              </template>
            </Column>
            <Column header="Montant">
              <template #body="{ data }">
                <span :class="{ debit: data.amount_xpf < 0, credit: data.amount_xpf > 0 }">
                  {{ data.amount_xpf > 0 ? '+' : '' }}{{ data.amount_xpf }} XPF
                </span>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>
    </template>

    <WalletDepositDialog v-model:visible="depositOpen" />
    <WalletPayoutDialog
      v-if="auth.isDriver"
      v-model:visible="payoutOpen"
      :balance-xpf="balance ?? 0"
      :min-balance-xpf="minPayoutBalance"
    />
  </div>
</template>

<style scoped>
.balance {
  text-align: center;
}
.amount {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--p-primary-color);
}
.actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 1rem;
}
.payout-wrap {
  display: inline-block;
}
.payout-hint {
  text-align: center;
  margin: 0.75rem 0 0;
  font-size: 0.85rem;
}
.debit {
  color: var(--p-red-500);
}
.credit {
  color: var(--p-green-500);
}
</style>
