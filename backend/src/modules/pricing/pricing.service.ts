import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class PricingService {
  constructor(private readonly settings: SettingsService) {}

  /**
   * Total amount charged to the passenger:
   *   `fareBaseXpf + farePerKmXpf * km`
   *
   * Both components are configurable from `/admin/settings`. The base fee
   * (booking fee) and the per-km platform margin are both kept by the app —
   * see {@link computeDriverShare} for the split.
   */
  computeFare(distanceMeters: number): number {
    const base = this.settings.getNumber('app.fareBaseXpf', 0);
    const perKm = this.settings.getNumber('app.farePerKmXpf', 100);
    const km = Math.max(0, distanceMeters) / 1000;
    return Math.round(base + km * perKm);
  }

  /**
   * Portion of the fare that goes to the driver:
   *   `(farePerKmXpf - appMarginPerKmXpf) * km`
   *
   * The base fee stays with the platform, and a configurable per-km margin
   * (`app.appMarginPerKmXpf`) is also withheld from the per-km component.
   * The margin is clamped to `[0, perKm]` so the driver share can never go
   * negative, regardless of misconfiguration.
   */
  computeDriverShare(distanceMeters: number): number {
    const perKm = this.settings.getNumber('app.farePerKmXpf', 100);
    const rawMargin = this.settings.getNumber('app.appMarginPerKmXpf', 0);
    const margin = Math.min(Math.max(0, rawMargin), perKm);
    const km = Math.max(0, distanceMeters) / 1000;
    return Math.round(km * (perKm - margin));
  }
}
