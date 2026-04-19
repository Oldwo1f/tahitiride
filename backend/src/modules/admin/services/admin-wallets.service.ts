import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WalletTransactionType } from '../../../common/types/direction.enum';
import { AdminAction } from '../../../entities/admin-action.entity';
import { User } from '../../../entities/user.entity';
import { WalletTransaction } from '../../../entities/wallet-transaction.entity';
import { Wallet } from '../../../entities/wallet.entity';
import { AdminAuditService } from './admin-audit.service';

export interface AdminWalletsListQuery {
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface AdjustParams {
  userId: string;
  deltaXpf: number;
  reason: string;
  actorId: string;
}

@Injectable()
export class AdminWalletsService {
  constructor(
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly txs: Repository<WalletTransaction>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly audit: AdminAuditService,
  ) {}

  async list(query: AdminWalletsListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const qb = this.wallets
      .createQueryBuilder('w')
      .innerJoinAndSelect('w.user', 'u')
      .where('u.deleted_at IS NULL')
      .orderBy('w.balance_xpf', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    if (query.q) {
      qb.andWhere('(u.email ILIKE :q OR u.full_name ILIKE :q)', {
        q: `%${query.q}%`,
      });
    }
    const [rows, total] = await qb.getManyAndCount();
    return {
      total,
      page,
      pageSize,
      items: rows.map((w) => ({
        user_id: w.user_id,
        email: w.user.email,
        full_name: w.user.full_name,
        role: w.user.role,
        balance_xpf: w.balance_xpf,
        updated_at: w.updated_at,
      })),
    };
  }

  async getOne(userId: string) {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { wallet: true },
    });
    if (!user || user.deleted_at) {
      throw new NotFoundException('User not found');
    }
    const transactions = await this.txs.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: 100,
    });
    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
      balance_xpf: user.wallet?.balance_xpf ?? 0,
      transactions: transactions.map((t) => ({
        id: t.id,
        amount_xpf: t.amount_xpf,
        type: t.type,
        trip_id: t.trip_id,
        reason: t.reason,
        actor_user_id: t.actor_user_id,
        created_at: t.created_at,
      })),
    };
  }

  async adjust(params: AdjustParams) {
    if (!Number.isInteger(params.deltaXpf) || params.deltaXpf === 0) {
      throw new BadRequestException('Invalid delta');
    }
    return this.dataSource.transaction(async (tx) => {
      const userRepo = tx.getRepository(User);
      const walletRepo = tx.getRepository(Wallet);
      const txRepo = tx.getRepository(WalletTransaction);

      const target = await userRepo.findOne({ where: { id: params.userId } });
      if (!target || target.deleted_at) {
        throw new NotFoundException('User not found');
      }

      const wallet = await walletRepo
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.user_id = :id', { id: params.userId })
        .getOne();
      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const next = wallet.balance_xpf + params.deltaXpf;
      if (next < 0) {
        throw new BadRequestException('Adjustment would create overdraft');
      }

      wallet.balance_xpf = next;
      await walletRepo.save(wallet);

      await txRepo.save(
        txRepo.create({
          user_id: params.userId,
          amount_xpf: params.deltaXpf,
          type: WalletTransactionType.ADJUSTMENT,
          trip_id: null,
          reason: params.reason,
          actor_user_id: params.actorId,
        }),
      );

      await tx.getRepository(AdminAction).save(
        tx.getRepository(AdminAction).create({
          actor_user_id: params.actorId,
          action: 'wallet.adjust',
          target_type: 'user',
          target_id: params.userId,
          payload: {
            delta_xpf: params.deltaXpf,
            balance_after_xpf: next,
            reason: params.reason,
          },
        }),
      );
      void this.audit;

      return { user_id: params.userId, balance_xpf: next };
    });
  }
}
