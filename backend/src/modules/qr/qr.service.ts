import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { VehiclesService } from '../vehicles/vehicles.service';

export interface QrPayload {
  vid: string;
  did: string;
  jti: string;
  iat: number;
  exp: number;
}

@Injectable()
export class QrService {
  constructor(
    private readonly vehicles: VehiclesService,
    private readonly config: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.config.get<number>('app.qrRotationSeconds', 60);
  }

  async generateForDriver(
    driverUserId: string,
  ): Promise<{ token: string; exp: number; vehicle_id: string }> {
    const vehicle = await this.vehicles.getForUserStrict(driverUserId);
    const now = Math.floor(Date.now() / 1000);
    const ttl = this.ttlSeconds();
    const payload = {
      vid: vehicle.id,
      did: driverUserId,
      jti: uuidv4(),
    };
    const token = jwt.sign(payload, vehicle.qr_secret, { expiresIn: ttl });
    return { token, exp: now + ttl, vehicle_id: vehicle.id };
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
      throw new UnauthorizedException('Invalid or expired QR token');
    }
  }
}
