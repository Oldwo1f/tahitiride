import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { UserRole } from '../../../common/types/direction.enum';
import { User } from '../../../entities/user.entity';
import { Wallet } from '../../../entities/wallet.entity';

export interface UpsertAdminParams {
  email: string;
  password?: string;
  fullName?: string;
}

export interface UpsertResult {
  user: User;
  created: boolean;
  promoted: boolean;
  passwordReset: boolean;
}

/**
 * Idempotent helper to make sure at least one admin account exists. Used
 * both:
 *   - automatically at boot via `OnApplicationBootstrap` when the
 *     `BOOTSTRAP_ADMIN_EMAIL` env var is present (typical Docker prod flow);
 *   - manually by the `pnpm run admin:create` CLI script (`scripts/create-admin.ts`).
 *
 * Behaviour:
 *   - Email exists, role != admin → role flipped to admin, password kept.
 *   - Email exists, role == admin → no-op (and password is rotated only if
 *     a password is explicitly provided).
 *   - Email does not exist → user is created with a 0-balance wallet (admin
 *     accounts are not for ride-sharing, no welcome bonus).
 */
@Injectable()
export class BootstrapAdminService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapAdminService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
    const fullName =
      process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Administrator';
    if (!email) return;
    if (!password && !(await this.users.findOne({ where: { email } }))) {
      this.logger.warn(
        `BOOTSTRAP_ADMIN_EMAIL is set to "${email}" but the user does not exist and BOOTSTRAP_ADMIN_PASSWORD is empty — skipping bootstrap.`,
      );
      return;
    }
    void this.config;
    try {
      const result = await this.upsert({ email, password, fullName });
      const action = result.created
        ? 'created'
        : result.promoted
          ? 'promoted'
          : 'verified';
      this.logger.log(`Bootstrap admin ${email} ${action}.`);
    } catch (err) {
      this.logger.error(
        `Bootstrap admin failed for ${email}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async upsert(params: UpsertAdminParams): Promise<UpsertResult> {
    const email = params.email.trim().toLowerCase();
    if (!email) {
      throw new Error('Email is required');
    }
    return this.dataSource.transaction(async (tx) => {
      const userRepo = tx.getRepository(User);
      const walletRepo = tx.getRepository(Wallet);

      const existing = await userRepo.findOne({ where: { email } });

      if (existing) {
        let promoted = false;
        let passwordReset = false;
        if (existing.deleted_at) {
          existing.deleted_at = null;
          promoted = true;
        }
        if (existing.suspended_at) {
          existing.suspended_at = null;
          promoted = true;
        }
        if (existing.role !== UserRole.ADMIN) {
          existing.role = UserRole.ADMIN;
          promoted = true;
        }
        if (params.password) {
          existing.password_hash = await bcrypt.hash(params.password, 10);
          passwordReset = true;
        }
        if (promoted || passwordReset) {
          await userRepo.save(existing);
        }
        await this.ensureWallet(walletRepo, existing.id);
        return {
          user: existing,
          created: false,
          promoted,
          passwordReset,
        };
      }

      if (!params.password) {
        throw new Error('Password is required to create a new admin account');
      }
      const password_hash = await bcrypt.hash(params.password, 10);
      const created = await userRepo.save(
        userRepo.create({
          email,
          full_name: params.fullName || 'Administrator',
          password_hash,
          role: UserRole.ADMIN,
          phone: null,
        }),
      );
      await this.ensureWallet(walletRepo, created.id);
      return {
        user: created,
        created: true,
        promoted: false,
        passwordReset: false,
      };
    });
  }

  private async ensureWallet(
    walletRepo: Repository<Wallet>,
    userId: string,
  ): Promise<void> {
    const w = await walletRepo.findOne({ where: { user_id: userId } });
    if (!w) {
      await walletRepo.save(
        walletRepo.create({ user_id: userId, balance_xpf: 0 }),
      );
    }
  }
}
