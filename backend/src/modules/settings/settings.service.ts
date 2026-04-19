import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSetting } from '../../entities/app-setting.entity';

/**
 * Runtime overlay over `ConfigService`. Looks up `app_settings` rows first
 * (stored as JSONB) and falls back to env-based config when no row exists.
 *
 * The cache is hydrated once at boot and refreshed on every write through
 * `setValue` so admin updates take effect immediately without a restart.
 */
@Injectable()
export class SettingsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SettingsService.name);
  private readonly cache = new Map<string, unknown>();

  /**
   * Whitelist of admin-editable settings + their fallback config key. Anything
   * not in this map is rejected by the admin endpoint.
   */
  static readonly EDITABLE: ReadonlyArray<{
    key: string;
    configKey: string;
    label: string;
    type: 'integer';
    min: number;
    max: number;
  }> = [
    {
      key: 'app.fareBaseXpf',
      configKey: 'app.fareBaseXpf',
      label: 'Forfait de base par trajet (XPF)',
      type: 'integer',
      min: 0,
      max: 100_000,
    },
    {
      key: 'app.farePerKmXpf',
      configKey: 'app.farePerKmXpf',
      label: 'Tarif au kilomètre (XPF)',
      type: 'integer',
      min: 0,
      max: 100_000,
    },
    {
      key: 'app.initialWalletBalanceXpf',
      configKey: 'app.initialWalletBalanceXpf',
      label: 'Solde de bienvenue (XPF)',
      type: 'integer',
      min: 0,
      max: 1_000_000,
    },
    {
      key: 'app.pickupMaxDistanceMeters',
      configKey: 'app.pickupMaxDistanceMeters',
      label: 'Distance max passager-conducteur au scan (m)',
      type: 'integer',
      min: 1,
      max: 5_000,
    },
    {
      key: 'app.dropoffMinDelaySeconds',
      configKey: 'app.dropoffMinDelaySeconds',
      label: 'Durée minimale d’un trajet (s)',
      type: 'integer',
      min: 0,
      max: 3_600,
    },
    {
      key: 'app.nearbyDriversRadiusMeters',
      configKey: 'app.nearbyDriversRadiusMeters',
      label: 'Rayon d’affichage des conducteurs proches (m)',
      type: 'integer',
      min: 100,
      max: 50_000,
    },
  ];

  constructor(
    @InjectRepository(AppSetting)
    private readonly repo: Repository<AppSetting>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const rows = await this.repo.find();
      for (const row of rows) {
        this.cache.set(row.key, row.value);
      }
      this.logger.log(`Settings hydrated: ${rows.length} overrides`);
    } catch (err) {
      this.logger.warn(
        `Could not hydrate settings (table may be missing): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** Live cache snapshot, useful for the admin GET endpoint. */
  snapshot(): Record<string, unknown> {
    return Object.fromEntries(this.cache.entries());
  }

  getNumber(key: string, fallback: number): number {
    const cached = this.cache.get(key);
    if (typeof cached === 'number' && Number.isFinite(cached)) {
      return cached;
    }
    return this.config.get<number>(key, fallback);
  }

  getString(key: string, fallback: string): string {
    const cached = this.cache.get(key);
    if (typeof cached === 'string') {
      return cached;
    }
    return this.config.get<string>(key, fallback);
  }

  /**
   * Persist + refresh the cache. The `actorUserId` is stored on the row for
   * traceability (a separate `admin_actions` row is also written by the
   * caller for the immutable audit log).
   */
  async setValue(
    key: string,
    value: unknown,
    actorUserId: string,
  ): Promise<AppSetting> {
    const row = await this.repo.save(
      this.repo.create({
        key,
        value,
        updated_by_user_id: actorUserId,
      }),
    );
    this.cache.set(key, value);
    return row;
  }
}
