import type {
  DepositInfoDto,
  LastIbanDto,
  WalletLimitsDto,
  WalletRequestDto,
} from '~/types/api'

interface CreateDepositInput {
  amount_xpf: number
  user_note?: string | null
}

interface CreatePayoutInput {
  amount_xpf: number
  iban: string
  account_holder_name: string
  user_note?: string | null
}

/**
 * Wallet-requests data hook used by the wallet page and its dialogs.
 *
 * Listens for `wallet:request:updated` to refresh the list when the
 * admin processes a request, and surfaces a success/warn toast so the
 * user knows what happened (the page may not be visible at that moment,
 * the toast is the only feedback).
 */
export function useWalletRequests() {
  const api = useApi()
  const socket = useSocket()
  const auth = useAuthStore()
  const toast = useToast()

  const requests = ref<WalletRequestDto[]>([])
  const limits = ref<WalletLimitsDto | null>(null)
  const loading = ref(false)
  const submitting = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const [list, lim] = await Promise.all([
        api<WalletRequestDto[]>('/api/wallet-requests/mine'),
        api<WalletLimitsDto>('/api/wallet/limits'),
      ])
      requests.value = list
      limits.value = lim
    } catch (e: unknown) {
      error.value = extractMessage(e, 'Chargement impossible')
    } finally {
      loading.value = false
    }
  }

  async function fetchDepositInfo(): Promise<DepositInfoDto> {
    return api<DepositInfoDto>('/api/wallet/deposit-info')
  }

  async function fetchLastIban(): Promise<LastIbanDto> {
    return api<LastIbanDto>('/api/wallet-requests/last-iban')
  }

  async function createDeposit(
    input: CreateDepositInput,
  ): Promise<WalletRequestDto> {
    submitting.value = true
    try {
      const created = await api<WalletRequestDto>(
        '/api/wallet-requests/deposit',
        {
          method: 'POST',
          body: {
            amount_xpf: input.amount_xpf,
            user_note: input.user_note ?? undefined,
          },
        },
      )
      upsert(created)
      return created
    } finally {
      submitting.value = false
    }
  }

  async function createPayout(
    input: CreatePayoutInput,
  ): Promise<WalletRequestDto> {
    submitting.value = true
    try {
      const created = await api<WalletRequestDto>(
        '/api/wallet-requests/payout',
        {
          method: 'POST',
          body: {
            amount_xpf: input.amount_xpf,
            iban: input.iban.replace(/\s+/g, '').toUpperCase(),
            account_holder_name: input.account_holder_name,
            user_note: input.user_note ?? undefined,
          },
        },
      )
      upsert(created)
      return created
    } finally {
      submitting.value = false
    }
  }

  async function cancel(requestId: string): Promise<WalletRequestDto> {
    const updated = await api<WalletRequestDto>(
      `/api/wallet-requests/${requestId}/cancel`,
      { method: 'POST' },
    )
    upsert(updated)
    return updated
  }

  function upsert(req: WalletRequestDto): void {
    const idx = requests.value.findIndex((r) => r.id === req.id)
    if (idx === -1) {
      requests.value = [req, ...requests.value]
    } else {
      const next = [...requests.value]
      next[idx] = req
      requests.value = next
    }
  }

  function onUpdated(req: WalletRequestDto): void {
    if (!auth.user || req.user_id !== auth.user.id) return
    upsert(req)
    if (req.status === 'approved') {
      toast.add({
        severity: 'success',
        summary:
          req.type === 'deposit'
            ? 'Dépôt validé'
            : 'Retrait validé',
        detail:
          req.type === 'deposit'
            ? `Votre wallet a été crédité de ${req.amount_xpf} XPF.`
            : `Votre wallet a été débité de ${req.amount_xpf} XPF, le virement a été effectué.`,
        life: 5000,
      })
    } else if (req.status === 'rejected') {
      toast.add({
        severity: 'warn',
        summary:
          req.type === 'deposit' ? 'Dépôt rejeté' : 'Retrait rejeté',
        detail: req.admin_note ?? 'Aucune raison fournie',
        life: 6000,
      })
    } else if (req.status === 'cancelled') {
      toast.add({
        severity: 'info',
        summary: 'Demande annulée',
        life: 3000,
      })
    }
  }

  if (import.meta.client) {
    socket.on('wallet:request:updated', onUpdated)
    onScopeDispose(() => {
      socket.off('wallet:request:updated', onUpdated)
    })
  }

  return {
    requests,
    limits,
    loading,
    submitting,
    error,
    load,
    fetchDepositInfo,
    fetchLastIban,
    createDeposit,
    createPayout,
    cancel,
  }
}

function extractMessage(e: unknown, fallback: string): string {
  const data = (e as { data?: { message?: string | string[] } })?.data
  const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message
  return msg || (e as { message?: string })?.message || fallback
}
