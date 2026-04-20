import type { TripStatus, UserRole } from '~/types/api'

/**
 * Shared formatters used across admin pages. Locale is fixed to fr-FR for
 * consistent thousands separators and date layout, regardless of the
 * browser's UI language.
 */
export function useAdminFormat() {
  const xpf = new Intl.NumberFormat('fr-FR')
  const dateLong = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const dateShort = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })

  function formatXpf(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '—'
    return `${xpf.format(value)} XPF`
  }

  function formatDistance(meters: number | null | undefined): string {
    if (meters === null || meters === undefined || Number.isNaN(meters))
      return '—'
    if (meters < 1000) return `${Math.round(meters)} m`
    return `${(meters / 1000).toFixed(2).replace('.', ',')} km`
  }

  function formatDate(value: string | Date | null | undefined): string {
    if (!value) return '—'
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return dateLong.format(d)
  }

  function formatDateShort(value: string | Date | null | undefined): string {
    if (!value) return '—'
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return dateShort.format(d)
  }

  const ROLE_LABEL: Record<UserRole, string> = {
    user: 'Utilisateur',
    admin: 'Admin',
  }
  function formatRole(role: UserRole | string | null | undefined): string {
    if (!role) return '—'
    return ROLE_LABEL[role as UserRole] ?? role
  }
  function roleSeverity(
    role: UserRole | string | null | undefined,
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (role) {
      case 'admin':
        return 'danger'
      case 'user':
        return 'info'
      default:
        return 'secondary'
    }
  }

  const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
    active: 'En cours',
    completed: 'Terminé',
    cancelled: 'Annulé',
  }
  function formatTripStatus(s: TripStatus | string | null | undefined): string {
    if (!s) return '—'
    return TRIP_STATUS_LABEL[s as TripStatus] ?? s
  }
  function tripStatusSeverity(
    s: TripStatus | string | null | undefined,
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (s) {
      case 'active':
        return 'info'
      case 'completed':
        return 'success'
      case 'cancelled':
        return 'danger'
      default:
        return 'secondary'
    }
  }

  return {
    formatXpf,
    formatDistance,
    formatDate,
    formatDateShort,
    formatRole,
    roleSeverity,
    formatTripStatus,
    tripStatusSeverity,
    ROLE_LABEL,
    TRIP_STATUS_LABEL,
  }
}
