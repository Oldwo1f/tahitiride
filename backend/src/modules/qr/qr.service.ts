import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { VehiclesService } from '../vehicles/vehicles.service';

/**
 * Stable QR payload printed once and physically displayed in the vehicle.
 * - `vid`: vehicle id (also used as `jti` for traceability)
 * - `did`: driver/owner id
 *
 * The token is signed without `expiresIn` so it never expires; per-trip
 * uniqueness is enforced server-side at scan time (see TripsService).
 */
export interface QrPayload {
  vid: string;
  did: string;
  jti: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class QrService {
  constructor(private readonly vehicles: VehiclesService) {}

  async generateForDriver(driverUserId: string): Promise<{
    token: string;
    vehicle_id: string;
    plate: string;
  }> {
    const vehicle = await this.vehicles.getForUserStrict(driverUserId);
    const payload = {
      vid: vehicle.id,
      did: driverUserId,
      jti: vehicle.id,
    };
    // Permanent token: no `expiresIn` => no `exp` claim. Anti-fraud is handled
    // by the trip lifecycle, not by token rotation.
    const token = jwt.sign(payload, vehicle.qr_secret);
    return { token, vehicle_id: vehicle.id, plate: vehicle.plate };
  }

  async validate(token: string): Promise<QrPayload> {
    const decoded = jwt.decode(token) as QrPayload | null;
    if (
      !decoded ||
      typeof decoded !== 'object' ||
      !decoded.vid ||
      !decoded.did
    ) {
      throw new BadRequestException('Invalid QR token');
    }

    const vehicle = await this.vehicles.getById(decoded.vid);
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    if (vehicle.user_id !== decoded.did) {
      throw new UnauthorizedException('QR token does not match vehicle owner');
    }

    try {
      return jwt.verify(token, vehicle.qr_secret) as QrPayload;
    } catch {
      throw new UnauthorizedException('Invalid QR token');
    }
  }
}
