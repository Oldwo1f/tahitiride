import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WalletRequestStatus,
  WalletRequestType,
} from '../../common/types/direction.enum';
import { User } from '../../entities/user.entity';
import { WalletRequest } from '../../entities/wallet-request.entity';
import { Wallet } from '../../entities/wallet.entity';
import { RealtimeBus } from '../realtime-bus/realtime-bus.service';
import { SettingsService } from '../settings/settings.service';
import type { CreateDepositDto } from './dto/create-deposit.dto';
import type { CreatePayoutDto } from './dto/create-payout.dto';

const IBAN_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;

@Injectable()
export class WalletRequestsService {
  constructor(
    @InjectRepository(WalletRequest)
    private readonly requests: Repository<WalletRequest>,
    @InjectRepository(Wallet)
    private readonly wallets: Repository<Wallet>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
    private readonly bus: RealtimeBus,
  ) {}

  /**
   * Read the platform's bank coordinates so the deposit dialog can show
   * the user where to wire the funds. Falls back to the static config
   * when no admin override has been set yet.
   */
  getDepositInfo() {
    const min = this.settings.getNumber(
      'app.depositMinAmountXpf',
      this.config.get<number>('app.depositMinAmountXpf', 100),
    );
    return {
      bank_name: this.settings.getString(
        'app.bankName',
        this.config.get<string>('app.bankName', '') ?? '',
      ),
      iban: this.settings.getString(
        'app.bankIban',
        this.config.get<string>('app.bankIban', '') ?? '',
      ),
      bic: this.settings.getString(
        'app.bankBic',
        this.config.get<string>('app.bankBic', '') ?? '',
      ),
      account_holder: this.settings.getString(
        'app.bankAccountHolder',
        this.config.get<string>('app.bankAccountHolder', '') ?? '',
      ),
      instructions: this.settings.getString(
        'app.bankInstructions',
        this.config.get<string>('app.bankInstructions', '') ?? '',
      ),
      min_amount_xpf: min,
    };
  }

  getLimits() {
    const payoutMin = this.settings.getNumber(
      'app.payoutMinBalanceXpf',
      this.config.get<number>('app.payoutMinBalanceXpf', 1000),
    );
    const depositMin = this.settings.getNumber(
      'app.depositMinAmountXpf',
      this.config.get<number>('app.depositMinAmountXpf', 100),
    );
    return {
      payout_min_balance_xpf: payoutMin,
      deposit_min_amount_xpf: depositMin,
    };
  }

  async createDeposit(userId: string, dto: CreateDepositDto) {
    const min = this.settings.getNumber(
      'app.depositMinAmountXpf',
      this.config.get<number>('app.depositMinAmountXpf', 100),
    );
    if (!Number.isInteger(dto.amount_xpf) || dto.amount_xpf < min) {
      throw new BadRequestException(
        `Le montant minimum pour un dépôt est de ${min} XPF`,
      );
    }
    const row = await this.requests.save(
      this.requests.create({
        user_id: userId,
        type: WalletRequestType.DEPOSIT,
        status: WalletRequestStatus.PENDING,
        amount_xpf: dto.amount_xpf,
        user_note: dto.user_note?.trim() || null,
      }),
    );
    this.notifyAdminsNewRequest(row);
    return this.toDto(row);
  }

  async createPayout(userId: string, dto: CreatePayoutDto) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.deleted_at) {
      throw new NotFoundException('User not found');
    }
    if (!user.is_driver) {
      throw new ForbiddenException(
        'Seuls les conducteurs peuvent demander un retrait',
      );
    }

    const cleanedIban = dto.iban.replace(/\s+/g, '').toUpperCase();
    if (!IBAN_REGEX.test(cleanedIban)) {
      throw new BadRequestException('IBAN format invalide');
    }

    const minBalance = this.settings.getNumber(
      'app.payoutMinBalanceXpf',
      this.config.get<number>('app.payoutMinBalanceXpf', 1000),
    );
    const wallet = await this.wallets.findOne({ where: { user_id: userId } });
    const balance = wallet?.balance_xpf ?? 0;
    if (balance < minBalance) {
      throw new BadRequestException(
        `Solde insuffisant : minimum ${minBalance} XPF requis`,
      );
    }
    if (!Number.isInteger(dto.amount_xpf) || dto.amount_xpf <= 0) {
      throw new BadRequestException('Montant invalide');
    }
    if (dto.amount_xpf > balance) {
      throw new BadRequestException(
        `Le montant demandé dépasse votre solde (${balance} XPF)`,
      );
    }

    const pending = await this.requests.count({
      where: {
        user_id: userId,
        type: WalletRequestType.PAYOUT,
        status: WalletRequestStatus.PENDING,
      },
    });
    if (pending > 0) {
      throw new BadRequestException(
        'Vous avez déjà une demande de retrait en attente',
      );
    }

    const row = await this.requests.save(
      this.requests.create({
        user_id: userId,
        type: WalletRequestType.PAYOUT,
        status: WalletRequestStatus.PENDING,
        amount_xpf: dto.amount_xpf,
        iban: cleanedIban,
        account_holder_name: dto.account_holder_name.trim().slice(0, 120),
        user_note: dto.user_note?.trim() || null,
      }),
    );
    this.notifyAdminsNewRequest(row);
    return this.toDto(row);
  }

  async cancelMine(userId: string, requestId: string) {
    const row = await this.requests.findOne({ where: { id: requestId } });
    if (!row || row.user_id !== userId) {
      throw new NotFoundException('Demande introuvable');
    }
    if (row.status !== WalletRequestStatus.PENDING) {
      throw new BadRequestException(
        'Seules les demandes en attente peuvent être annulées',
      );
    }
    row.status = WalletRequestStatus.CANCELLED;
    row.processed_at = new Date();
    row.processed_by_user_id = userId;
    const saved = await this.requests.save(row);

    this.bus.emitToUser(userId, 'wallet:request:updated', this.toDto(saved));
    this.bus.emitToRole('admin', 'wallet:request:updated', this.toDto(saved));
    void this.broadcastPendingCount();

    return this.toDto(saved);
  }

  async listMine(userId: string, limit = 50) {
    const rows = await this.requests.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: Math.min(limit, 200),
    });
    return rows.map((r) => this.toDto(r));
  }

  /**
   * Returns the IBAN + holder of the user's most recent payout request
   * (any status), so the dialog can pre-fill the form. Returns nulls
   * when the user never requested a payout.
   */
  async getLastIban(userId: string) {
    const row = await this.requests.findOne({
      where: { user_id: userId, type: WalletRequestType.PAYOUT },
      order: { created_at: 'DESC' },
    });
    return {
      iban: row?.iban ?? null,
      account_holder_name: row?.account_holder_name ?? null,
    };
  }

  private notifyAdminsNewRequest(row: WalletRequest): void {
    this.bus.emitToRole('admin', 'wallet:request:new', this.toDto(row));
    void this.broadcastPendingCount();
  }

  private async broadcastPendingCount(): Promise<void> {
    try {
      const count = await this.requests.count({
        where: { status: WalletRequestStatus.PENDING },
      });
      this.bus.emitToRole('admin', 'wallet:request:pending-count', { count });
    } catch {
      // best-effort badge update; failures are non-fatal
    }
  }

  toDto(r: WalletRequest) {
    return {
      id: r.id,
      user_id: r.user_id,
      type: r.type,
      status: r.status,
      amount_xpf: r.amount_xpf,
      iban: r.iban,
      account_holder_name: r.account_holder_name,
      user_note: r.user_note,
      admin_note: r.admin_note,
      processed_by_user_id: r.processed_by_user_id,
      processed_at: r.processed_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }
}
