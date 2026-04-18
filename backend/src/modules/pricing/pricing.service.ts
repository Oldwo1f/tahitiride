import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PricingService {
  constructor(private readonly config: ConfigService) {}

  computeFare(distanceMeters: number): number {
    const base = this.config.get<number>('app.fareBaseXpf', 200);
    const perKm = this.config.get<number>('app.farePerKmXpf', 100);
    const km = Math.max(0, distanceMeters) / 1000;
    return Math.round(base + km * perKm);
  }
}
