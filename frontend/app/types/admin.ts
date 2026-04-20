import type {
  Certification,
  TripStatus,
  UserRole,
  WalletRequestStatus,
  WalletRequestType,
  WalletTransactionKind,
} from './api'

export interface AdminPaginated<T> {
  total: number
  page: number
  pageSize: number
  items: T[]
}

export interface AdminUserListItem {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  is_driver: boolean
  created_at: string
  suspended_at: string | null
  balance_xpf: number
}

export interface AdminUserVehicle {
  id: string
  plate: string
  model: string
  color: string
  created_at: string
}

export interface AdminUserDetail {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  is_driver: boolean
  created_at: string
  suspended_at: string | null
  deleted_at: string | null
  vehicles?: AdminUserVehicle[]
  wallet?: { balance_xpf: number; updated_at: string } | null
}

export interface AdminWalletListItem {
  user_id: string
  email: string
  full_name: string
  role: UserRole
  balance_xpf: number
  updated_at: string
}

export interface AdminWalletTransaction {
  id: string
  amount_xpf: number
  type: WalletTransactionKind
  trip_id: string | null
  reason: string | null
  actor_user_id: string | null
  created_at: string
}

export interface AdminWalletDetail {
  user: { id: string; email: string; full_name: string; role: UserRole }
  balance_xpf: number
  transactions: AdminWalletTransaction[]
}

export interface AdminTripListItem {
  id: string
  status: TripStatus
  started_at: string
  ended_at: string | null
  distance_m: number | null
  fare_xpf: number | null
  driver_share_xpf: number | null
  passenger_id: string
  passenger_email: string | null
  passenger_name: string | null
  driver_id: string
  driver_email: string | null
  driver_name: string | null
  vehicle_plate: string | null
  vehicle_model: string | null
  vehicle_color: string | null
}

export interface AdminTripDetail {
  id: string
  status: TripStatus
  started_at: string
  ended_at: string | null
  distance_m: number | null
  fare_xpf: number | null
  driver_share_xpf: number | null
  platform_margin_xpf: number | null
  points_count: number
  passenger: { id: string; email: string; full_name: string } | null
  driver: { id: string; email: string; full_name: string } | null
  vehicle: { id: string; plate: string; model: string; color: string } | null
}

export interface AdminTripGeometry {
  trip_id: string
  geometry: { type: 'LineString'; coordinates: [number, number][] } | null
}

export interface AdminVehicleListItem {
  id: string
  plate: string
  model: string
  color: string
  created_at: string
  user_id: string
  owner_email: string | null
  owner_name: string | null
}

export interface AdminSetting {
  key: string
  label: string
  type: 'integer' | 'string'
  /** Present when `type === 'integer'`. */
  min?: number
  /** Present when `type === 'integer'`. */
  max?: number
  /** Present when `type === 'string'`. */
  maxLength?: number
  /** Present when `type === 'string'`. Hints the UI to render a Textarea. */
  multiline?: boolean
  default: number | string | null
  override: number | string | null
  value: number | string
}

export interface AdminWalletRequestItem {
  id: string
  user_id: string
  user_email: string
  user_full_name: string
  type: WalletRequestType
  status: WalletRequestStatus
  amount_xpf: number
  iban: string | null
  account_holder_name: string | null
  user_note: string | null
  admin_note: string | null
  processed_by_user_id: string | null
  processed_by_email: string | null
  processed_at: string | null
  /** Live wallet balance of the requesting user, joined server-side. */
  balance_xpf: number
  created_at: string
  updated_at: string
}

export interface AdminWalletRequestPendingCount {
  count: number
}

export interface AdminAction {
  id: string
  actor_user_id: string
  actor_email: string | null
  action: string
  target_type: string
  target_id: string | null
  payload: Record<string, unknown>
  created_at: string
}

export interface AdminCertification extends Certification {
  user: {
    id: string
    email: string
    full_name: string
    first_name: string | null
    last_name: string | null
  }
  vehicle: {
    id: string
    plate: string
    model: string
    color: string
  } | null
}

export interface AdminOverview {
  users: {
    total: number
    by_role: Record<string, number>
    /** Count of users whose `is_driver` flag is true (active drivers). */
    drivers: number
    signups_last_30d: { date: string; count: number }[]
  }
  trips: {
    total: number
    by_status: Record<string, number>
    per_day_30d: { date: string; count: number }[]
  }
  finance: {
    platform_revenue_30d_xpf: number
    wallet_total_balance_xpf: number
  }
  top_drivers: {
    driver_id: string
    email: string
    full_name: string
    trips: number
    driver_revenue_xpf: number
  }[]
}
