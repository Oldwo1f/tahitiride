import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class PricingService {
  constructor(private readonly settings: SettingsService) {}

  /**
   * Total amount charged to the passenger: a flat booking/base fee plus a
   * per-kilometer component. The base fee is the platform's margin and is
   * NOT forwarded to the driver — see {@link computeDriverShare}.
   */
  computeFare(distanceMeters: number): number {
    const base = this.settings.getNumber('app.fareBaseXpf', 200);
    const perKm = this.settings.getNumber('app.farePerKmXpf', 100);
    const km = Math.max(0, distanceMeters) / 1000;
    return Math.round(base + km * perKm);
  }

  /**
   * Portion of the fare that effectively goes to the driver: distance
   * component only. The base fee is kept by the platform.
   */
  computeDriverShare(distanceMeters: number): number {
    const perKm = this.settings.getNumber('app.farePerKmXpf', 100);
    const km = Math.max(0, distanceMeters) / 1000;
    return Math.round(km * perKm);
  }
}
