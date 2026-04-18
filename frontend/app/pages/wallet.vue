<script setup lang="ts">
import type { WalletBalance, WalletTransactionDto } from '~/types/api'

definePageMeta({
  middleware: ['auth'],
})

const api = useApi()
const balance = ref<number | null>(null)
const transactions = ref<WalletTransactionDto[]>([])
const loading = ref(true)
const errorMsg = ref<string | null>(null)

async function load() {
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

onMounted(load)
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
            <div class="tr-subtle">Solde (démo)</div>
            <div class="amount">{{ balance ?? 0 }} XPF</div>
          </div>
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
.debit {
  color: var(--p-red-500);
}
.credit {
  color: var(--p-green-500);
}
</style>
