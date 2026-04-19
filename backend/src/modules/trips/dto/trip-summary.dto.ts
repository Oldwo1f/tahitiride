import { TripStatus } from '../../../common/types/direction.enum';

/**
 * Lightweight, JSON-friendly representation of a trip with the strict
 * minimum needed by the user-facing trip history list. Server-only fields
 * (e.g. password hashes, qr secrets) are intentionally omitted.
 */
export interface TripSummaryDto {
  id: string;
  passenger_id: string;
  driver_id: string;
  vehicle_id: string;
  status: TripStatus;
  started_at: Date;
  ended_at: Date | null;
  distance_m: number | null;
  fare_xpf: number | null;

  /** Whether the current user was the passenger or the driver for this trip. */
  my_role: 'passenger' | 'driver';
  /** The other party's user id and display name. */
  partner_id: string;
  partner_name: string;
  /** Vehicle info to make the row identifiable at a glance. */
  vehicle_plate: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
}
