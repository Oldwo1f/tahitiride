import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CertificationsService } from './certifications.service';

/**
 * Daily background job that:
 *   - Marks approved-but-past-due certifications as `expired` and flips
 *     the matching `vehicles.is_certified` cache back to false.
 *   - Pushes WS reminders to drivers whose vignette expires within 14
 *     days. The frontend handles dedup via `localStorage`.
 *
 * Runs at 03:00 server time so daytime users see fresh state.
 */
@Injectable()
export class CertificationsScheduler {
  private readonly logger = new Logger(CertificationsScheduler.name);

  constructor(private readonly certs: CertificationsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDaily(): Promise<void> {
    try {
      const expired = await this.certs.expireOverdue();
      this.logger.log(
        `Daily expiry sweep: ${expired.certifications} certifications expired, ${expired.vehicles} vehicles decertified`,
      );
    } catch (err) {
      this.logger.error(`Daily expiry sweep failed: ${(err as Error).message}`);
    }
    try {
      const reminders = await this.certs.pushExpiringReminders();
      this.logger.log(
        `Daily reminder sweep: ${reminders.notified} drivers notified`,
      );
    } catch (err) {
      this.logger.error(
        `Daily reminder sweep failed: ${(err as Error).message}`,
      );
    }
  }
}
