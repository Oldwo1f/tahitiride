export type Direction = 'city' | 'country'
export type UserRole = 'user' | 'admin'
export type TripStatus = 'active' | 'completed' | 'cancelled'
export type WalletTransactionKind =
  | 'initial'
  | 'debit'
  | 'credit'
  | 'adjustment'

export interface AuthUser {
  id: string
  email: string
  full_name: string
  first_name: string | null
  last_name: string | null
  /** Relative URL `/api/uploads/avatars/<file>` or `null` when unset. */
  avatar_url: string | null
  role: UserRole
  /**
   * Independent capability flag: any user (including admins) can toggle
   * driver mode on/off. Governs whether the driver UI (map publisher, QR
   * scanner, payouts…) is active.
   */
  is_driver: boolean
  phone: string | null
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

export interface Vehicle {
  id: string
  user_id: string
  plate: string
  model: string
  color: string
  created_at: string
  is_certified?: boolean
  /** ISO date `YYYY-MM-DD` or null. Reflects the latest approved insurance vignette. */
  certified_until?: string | null
  /** Internal storage path (`vehicles/<file>`); rarely needed by the UI. */
  photo_path?: string | null
  /** Auth-protected URL `/api/uploads/vehicles/<file>` or `null`. */
  photo_url?: string | null
}

/**
 * Result of `POST /api/vehicles/photo/analyze`. Used by the driver
 * onboarding wizard to pre-fill the vehicle creation form.
 */
export interface OcrVehicleExtraction {
  make: string | null
  model: string | null
  color: string | null
  plate: string | null
  /** 0..1 confidence reported by the OCR backend. */
  confidence: number | null
  /** Human-readable note when confidence is low (or null). */
  decision_notes: string | null
}

/**
 * Response of `POST /api/vehicles/mine`. `user_promoted` is true when the
 * call auto-activated driver mode (`is_driver` flipped from false to true)
 * because this is the user's first registered vehicle; the frontend can
 * use `user_is_driver` to refresh its auth store without an extra round trip.
 */
export interface CreateVehicleResponse {
  vehicle: Vehicle
  user_promoted: boolean
  user_is_driver: boolean
}

export type CertificationType = 'license' | 'insurance'
export type CertificationStatus =
  | 'pending_ocr'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'expired'

export interface CertificationOcrPayload {
  name?: string | null
  plate?: string | null
  expires_at?: string | null
  confidence?: number | null
  decision_notes?: string | null
  raw?: unknown
}

export interface Certification {
  id: string
  user_id: string
  vehicle_id: string | null
  type: CertificationType
  status: CertificationStatus
  /** Auth-protected URL (`/api/uploads/...`). */
  file_url: string
  ocr_extracted: CertificationOcrPayload | null
  rejection_reason: string | null
  expires_at: string | null
  created_at: string
  reviewed_at: string | null
}

export interface VehicleCertification {
  vehicle_id: string
  plate: string
  model: string
  color: string
  is_certified: boolean
  certified_until: string | null
  expires_in_days: number | null
  needs_renewal_reminder: boolean
  latest: Certification | null
}

export interface MyCertifications {
  license: Certification | null
  vehicles: VehicleCertification[]
}

export interface CertificationExpiringEvent {
  vehicle_id: string
  plate: string
  certified_until: string | null
  days_left: number | null
}

export interface CertificationUpdatedEvent {
  id: string
  type: CertificationType
  status: CertificationStatus
  vehicle_id: string | null
  expires_at?: string | null
  rejection_reason?: string | null
}

export interface QrTokenResponse {
  token: string
  vehicle_id: string
  plate: string
}

export interface NearbyDriver {
  user_id: string
  vehicle_id: string | null
  plate: string | null
  model: string | null
  color: string | null
  direction: Direction
  destination: string | null
  lng: number
  lat: number
  heading?: number | null
  speed?: number | null
}

export interface NearbyPassenger {
  user_id: string
  direction: Direction
  destination: string | null
  lng: number
  lat: number
}

export interface Trip {
  id: string
  passenger_id: string
  driver_id: string
  vehicle_id: string
  status: TripStatus
  started_at: string
  ended_at: string | null
  distance_m: number | null
  /** Total amount the passenger paid for this trip. */
  fare_xpf: number | null
  /** Portion of `fare_xpf` actually credited to the driver (excluding the platform booking fee). */
  driver_share_xpf: number | null
  pickup_token_jti: string
  dropoff_token_jti: string | null
}

export interface TripSummary {
  id: string
  passenger_id: string
  driver_id: string
  vehicle_id: string
  status: TripStatus
  started_at: string
  ended_at: string | null
  distance_m: number | null
  fare_xpf: number | null
  driver_share_xpf: number | null
  my_role: 'passenger' | 'driver'
  partner_id: string
  partner_name: string
  vehicle_plate: string | null
  vehicle_model: string | null
  vehicle_color: string | null
}

export interface TripStartedEvent {
  trip_id: string
  passenger_id: string
  driver_id: string
  vehicle_id: string
  started_at: string
}

export interface TripCompletedEvent {
  trip_id: string
  distance_m: number | null
  fare_xpf: number | null
  ended_at: string
}

/** Emitted by the backend when a passenger taps "I'm getting out". */
export interface TripDropoffRequestedEvent {
  trip_id: string
  passenger_id: string
  passenger_name: string
  lng: number
  lat: number
  requested_at: string
}

export interface TripEstimate {
  distance_m: number
  duration_s: number
  fare_xpf: number
}

export interface WalletBalance {
  balance_xpf: number
}

export interface WalletTransactionDto {
  id: string
  user_id: string
  amount_xpf: number
  type: WalletTransactionKind
  trip_id: string | null
  created_at: string
}

export type WalletRequestType = 'deposit' | 'payout'
export type WalletRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'

export interface WalletRequestDto {
  id: string
  user_id: string
  type: WalletRequestType
  status: WalletRequestStatus
  amount_xpf: number
  iban: string | null
  account_holder_name: string | null
  user_note: string | null
  admin_note: string | null
  processed_by_user_id: string | null
  processed_at: string | null
  created_at: string
  updated_at: string
}

export interface DepositInfoDto {
  bank_name: string
  iban: string
  bic: string
  account_holder: string
  instructions: string
  min_amount_xpf: number
}

export interface WalletLimitsDto {
  payout_min_balance_xpf: number
  deposit_min_amount_xpf: number
}

export interface LastIbanDto {
  iban: string | null
  account_holder_name: string | null
}

export interface WalletRequestPendingCountEvent {
  count: number
}

export interface GeolocationFix {
  lat: number
  lng: number
  accuracy: number | null
  heading: number | null
  speed: number | null
  ts: number
}

export interface DriversSnapshotEvent {
  drivers: NearbyDriver[]
}

export interface PassengersSnapshotEvent {
  passengers: NearbyPassenger[]
}

export interface UserIdEvent {
  user_id: string
}
