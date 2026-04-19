import type {
  AdminPaginated,
  AdminWalletRequestItem,
  AdminWalletRequestPendingCount,
} from '~/types/admin'
import type {
  WalletRequestPendingCountEvent,
  WalletRequestStatus,
  WalletRequestType,
} from '~/types/api'

interface ListQuery {
  type?: WalletRequestType | null
  status?: WalletRequestStatus | null
  page?: number
  pageSize?: number
}

interface ApproveInput {
  admin_note?: string
}
interface RejectInput {
  admin_note: string
}

interface AdminWalletRequestsApi {
  /** Reactive count of `pending` rows; auto-updated via socket. */
  pendingCount: Readonly<Ref<number>>
  /** Manual one-shot refresh of the badge (e.g. on app start). */
  refreshPendingCount: () => Promise<void>
  /** Server-paginated list with filters. */
  list: (q?: ListQuery) => Promise<AdminPaginated<AdminWalletRequestItem>>
  /** Mark a `pending` request as approved (transactional on the backend). */
  approve: (
    id: string,
    input?: ApproveInput,
  ) => Promise<AdminWalletRequestItem>
  /** Mark a `pending` request as rejected (admin_note required). */
  reject: (id: string, input: RejectInput) => Promise<AdminWalletRequestItem>
}

let singleton: AdminWalletRequestsApi | null = null

/**
 * Per-app singleton hook used by both the admin layout (badge) and the
 * `/admin/wallet-requests` page. Centralising it avoids duplicate socket
 * handlers and ensures the badge counter stays in sync with whatever the
 * page does (approve/reject locally → broadcast → both consumers update).
 */
export function useAdminWalletRequests(): AdminWalletRequestsApi {
  if (singleton) return singleton

  const adminApi = useAdminApi()
  const socket = useSocket()
  const auth = useAuthStore()

  const pendingCount = ref(0)

  async function refreshPendingCount(): Promise<void> {
    if (!auth.isAdmin) return
    try {
      const { count } =
        await adminApi.get<AdminWalletRequestPendingCount>(
          '/wallet-requests/pending-count',
        )
      pendingCount.value = count
    } catch {
      // best-effort: keep the previous value on transient errors
    }
  }

  async function list(
    q: ListQuery = {},
  ): Promise<AdminPaginated<AdminWalletRequestItem>> {
    return adminApi.get<AdminPaginated<AdminWalletRequestItem>>(
      '/wallet-requests',
      {
        type: q.type ?? null,
        status: q.status ?? null,
        page: q.page ?? 1,
        pageSize: q.pageSize ?? 25,
      },
    )
  }

  async function approve(
    id: string,
    input: ApproveInput = {},
  ): Promise<AdminWalletRequestItem> {
    return adminApi.post<AdminWalletRequestItem>(
      `/wallet-requests/${id}/approve`,
      input,
    )
  }

  async function reject(
    id: string,
    input: RejectInput,
  ): Promise<AdminWalletRequestItem> {
    return adminApi.post<AdminWalletRequestItem>(
      `/wallet-requests/${id}/reject`,
      input,
    )
  }

  if (import.meta.client) {
    function onPendingCount(payload: WalletRequestPendingCountEvent) {
      if (typeof payload?.count === 'number') {
        pendingCount.value = payload.count
      }
    }
    function onNew() {
      // Optimistic bump; the broadcast right after will overwrite anyway.
      pendingCount.value = pendingCount.value + 1
    }

    socket.on('wallet:request:pending-count', onPendingCount)
    socket.on('wallet:request:new', onNew)

    // Refresh whenever the user logs in/out so we don't keep stale numbers
    // for the previous account.
    watch(
      () => auth.isAdmin,
      (isAdmin) => {
        if (isAdmin) void refreshPendingCount()
        else pendingCount.value = 0
      },
      { immediate: true },
    )
  }

  singleton = {
    pendingCount: readonly(pendingCount),
    refreshPendingCount,
    list,
    approve,
    reject,
  }
  return singleton
}
