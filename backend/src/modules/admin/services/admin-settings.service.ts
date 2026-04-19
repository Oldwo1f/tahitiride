import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../../settings/settings.service';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
    private readonly audit: AdminAuditService,
  ) {}

  /**
   * Returns the editable settings with their current effective value
   * (overlay if any, env-based default otherwise) plus their bounds and
   * label for display.
   */
  list() {
    const overrides = this.settings.snapshot();
    return SettingsService.EDITABLE.map((entry) => {
      const overrideValue = overrides[entry.key];
      const effective =
        overrideValue !== undefined
          ? overrideValue
          : this.config.get(entry.configKey);
      return {
        key: entry.key,
        label: entry.label,
        type: entry.type,
        min: entry.min,
        max: entry.max,
        default: this.config.get(entry.configKey),
        override: overrideValue ?? null,
        value: effective,
      };
    });
  }

  async update(key: string, rawValue: unknown, actorId: string) {
    const meta = SettingsService.EDITABLE.find((e) => e.key === key);
    if (!meta) {
      throw new BadRequestException('Unknown setting');
    }
    const previous = this.settings.snapshot()[key] ?? null;

    let value: number;
    if (meta.type === 'integer') {
      const n = typeof rawValue === 'number' ? rawValue : Number(rawValue);
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        throw new BadRequestException(`Setting ${key} must be an integer`);
      }
      if (n < meta.min || n > meta.max) {
        throw new BadRequestException(
          `Setting ${key} must be between ${meta.min} and ${meta.max}`,
        );
      }
      value = n;
    } else {
      throw new BadRequestException('Unsupported setting type');
    }

    await this.settings.setValue(key, value, actorId);
    await this.audit.record({
      actorId,
      action: 'settings.update',
      targetType: 'setting',
      targetId: null,
      payload: { key, previous, next: value },
    });
    return { key, value };
  }
}
