import type {
  CertificationExpiringEvent,
  CertificationUpdatedEvent,
} from '~/types/api'

interface ReminderEntry extends CertificationExpiringEvent {
  /** Epoch ms when the user dismissed the reminder. */
  dismissed_at: number | null
  /** Epoch ms last time the server pushed the event. */
  last_seen: number
}

const DISMISS_TTL_MS = 24 * 60 * 60 * 1000 // 24h
const STORAGE_KEY = 'kartiki-cert-reminders'

interface PersistedReminders {
  entries: Record<string, ReminderEntry>
}

function loadStorage(): PersistedReminders {
  if (!import.meta.client) return { entries: {} }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { entries: {} }
    const parsed = JSON.parse(raw) as Partial<PersistedReminders>
    return { entries: parsed.entries ?? {} }
  } catch {
    return { entries: {} }
  }
}

function persistStorage(state: PersistedReminders): void {
  if (!import.meta.client) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota exceeded — ignore */
  }
}

interface ReminderApi {
  /** Reactive list of reminders the user hasn't dismissed (within TTL). */
  active: Readonly<Ref<CertificationExpiringEvent[]>>
  /** Mark a vehicle's reminder as dismissed (snoozes for 24h). */
  dismiss: (vehicleId: string) => void
  /** Clear stored entries — used after a successful re-certification. */
  forget: (vehicleId: string) => void
  /**
   * Inject a reminder from a non-socket source (e.g. cold-start
   * `/api/certifications/me` lookup). Idempotent: same vehicle_id won't
   * produce duplicates and respects the existing dismissal timer.
   */
  notify: (event: CertificationExpiringEvent) => void
}

let singleton: ReminderApi | null = null

/**
 * Subscribes to `certification:expiring` socket events and exposes the
 * deduplicated list of vehicles needing renewal. Persists dismissals in
 * `localStorage` so the popup doesn't reappear at every page load.
 *
 * Designed as a per-app singleton: returns the same reactive list on
 * subsequent calls so multiple components stay in sync.
 */
export function useCertificationReminder(): ReminderApi {
  if (singleton) return singleton

  const socket = useSocket()
  const auth = useAuthStore()

  const entries = ref<Record<string, ReminderEntry>>({})
  if (import.meta.client) {
    entries.value = loadStorage().entries
  }

  function persist(): void {
    persistStorage({ entries: entries.value })
  }

  function isActive(entry: ReminderEntry): boolean {
    if (!entry.dismissed_at) return true
    return Date.now() - entry.dismissed_at >= DISMISS_TTL_MS
  }

  const active = computed<CertificationExpiringEvent[]>(() =>
    Object.values(entries.value)
      .filter(isActive)
      .sort((a, b) => (a.days_left ?? 0) - (b.days_left ?? 0))
      .map(({ vehicle_id, plate, certified_until, days_left }) => ({
        vehicle_id,
        plate,
        certified_until,
        days_left,
      })),
  )

  function ingest(event: CertificationExpiringEvent): void {
    const prev = entries.value[event.vehicle_id]
    const next: ReminderEntry = {
      vehicle_id: event.vehicle_id,
      plate: event.plate,
      certified_until: event.certified_until,
      days_left: event.days_left,
      dismissed_at: prev?.dismissed_at ?? null,
      last_seen: Date.now(),
    }
    // Only count as "fresh" if the date changed, so renewals reset the
    // dismissal timer automatically.
    if (prev && prev.certified_until !== event.certified_until) {
      next.dismissed_at = null
    }
    entries.value = { ...entries.value, [event.vehicle_id]: next }
    persist()
  }

  function dismiss(vehicleId: string): void {
    const prev = entries.value[vehicleId]
    if (!prev) return
    entries.value = {
      ...entries.value,
      [vehicleId]: { ...prev, dismissed_at: Date.now() },
    }
    persist()
  }

  function forget(vehicleId: string): void {
    if (!entries.value[vehicleId]) return
    const { [vehicleId]: _removed, ...rest } = entries.value
    void _removed
    entries.value = rest
    persist()
  }

  function onExpiring(event: CertificationExpiringEvent): void {
    if (!event?.vehicle_id) return
    ingest(event)
  }

  function onUpdated(event: CertificationUpdatedEvent): void {
    // Approval clears any stale reminders, so we don't keep nagging the
    // driver after a fresh insurance vignette has been validated.
    if (
      event.type === 'insurance' &&
      event.status === 'approved' &&
      event.vehicle_id
    ) {
      forget(event.vehicle_id)
    }
  }

  if (import.meta.client) {
    socket.on('certification:expiring', onExpiring)
    socket.on('certification:updated', onUpdated)

    // Drop everything on logout to avoid leaking reminders to the next
    // user on a shared device.
    watch(
      () => auth.token,
      (token) => {
        if (!token) {
          entries.value = {}
          persistStorage({ entries: {} })
        }
      },
    )
  }

  singleton = {
    active: readonly(active) as Readonly<Ref<CertificationExpiringEvent[]>>,
    dismiss,
    forget,
    notify: ingest,
  }
  return singleton
}
