export type Direction = 'city' | 'country'
export type UserRole = 'passenger' | 'driver' | 'both'
export type TripStatus = 'active' | 'completed' | 'cancelled'

export interface AuthUser {
  id: string
  email: string
  full_name: string
  role: UserRole
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
  fare_xpf: number | null
  pickup_token_jti: string
  dropoff_token_jti: string | null
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

export interface WalletBalance {
  balance_xpf: number
}

export interface WalletTransactionDto {
  id: string
  user_id: string
  amount_xpf: number
  type: 'initial' | 'debit' | 'credit'
  trip_id: string | null
  created_at: string
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
