import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  WalletRequestStatus,
  WalletRequestType,
  WalletTransactionType,
} from '../../../common/types/direction.enum';
import { AdminAction } from '../../../entities/admin-action.entity';
import { User } from '../../../entities/user.entity';
import { WalletRequest } from '../../../entities/wallet-request.entity';
import { WalletTransaction } from '../../../entities/wallet-transaction.entity';
import { Wallet } from '../../../entities/wallet.entity';
import { RealtimeBus } from '../../realtime-bus/realtime-bus.service';
import type { WalletRequestsListQueryDto } from '../dto/wallet-requests-list-query.dto';
import { AdminAuditService } from './admin-audit.service';

export interface AdminWalletRequestListItem {
  id: string;
  user_id: string;
  user_email: string;
  user_full_name: string;
  type: WalletRequestType;
  status: WalletRequestStatus;
  amount_xpf: number;
  iban: string | null;
  account_holder_name: string | null;
  user_note: string | null;
  admin_note: string | null;
  processed_by_user_id: string | null;
  processed_by_email: string | null;
  processed_at: Date | null;
  balance_xpf: number;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class AdminWalletRequestsService {
  constructor(
    @InjectRepository(WalletRequest)
    private readonly requests: Repository<WalletRequest>,
    @InjectRepository(Wallet)
    private readonly wallets: Repository<Wallet>,
    private readonly dataSource: DataSource,
    private readonly audit: AdminAuditService,
    private readonly bus: RealtimeBus,
  ) {}

  async list(query: WalletRequestsListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const qb = this.requests
      .createQueryBuilder('r')
      .innerJoin(User, 'u', 'u.id = r.user_id')
      .leftJoin(User, 'p', 'p.id = r.processed_by_user_id')
      .leftJoin(Wallet, 'w', 'w.user_id = r.user_id')
      .addSelect([
        'u.id',
        'u.email',
        'u.full_name',
        'p.id',
        'p.email',
        'w.balance_xpf',
      ])
      // We only have 1-to-1 joins, so it's safe to use SQL-level
      // limit/offset (faster and avoids TypeORM's `take()` rewriting
      // the ORDER BY into a subquery, which crashes on raw CASE
      // expressions).
      .orderBy(
        // pending first, then by recency
        `CASE WHEN r.status = '${WalletRequestStatus.PENDING}' THEN 0 ELSE 1 END`,
        'ASC',
      )
      .addOrderBy('r.created_at', 'DESC')
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    if (query.type) {
      qb.andWhere('r.type = :type', { type: query.type });
    }
    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }
    if (query.q) {
      qb.andWhere('(u.email ILIKE :q OR u.full_name ILIKE :q)', {
        q: `%${query.q}%`,
      });
    }

    const [rawRows, total] = await Promise.all([
      qb.getRawAndEntities(),
      qb.getCount(),
    ]);

    const items: AdminWalletRequestListItem[] = rawRows.entities.map(
      (r, idx) => {
        const raw = rawRows.raw[idx] as Record<string, unknown>;
        return {
          id: r.id,
          user_id: r.user_id,
          user_email: (raw.u_email as string) ?? '',
          user_full_name: (raw.u_full_name as string) ?? '',
          type: r.type,
          status: r.status,
          amount_xpf: r.amount_xpf,
          iban: r.iban,
          account_holder_name: r.account_holder_name,
          user_note: r.user_note,
          admin_note: r.admin_note,
          processed_by_user_id: r.processed_by_user_id,
          processed_by_email: (raw.p_email as string) ?? null,
          processed_at: r.processed_at,
          balance_xpf: Number(raw.w_balance_xpf ?? 0),
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      },
    );

    return { total, page, pageSize, items };
  }

  async pendingCount() {
    const count = await this.requests.count({
      where: { status: WalletRequestStatus.PENDING },
    });
    return { count };
  }

  /**
   * Approves a wallet request and moves the wallet balance accordingly.
   *
   * Idempotency is enforced by re-locking the request inside the
   * transaction and refusing anything that is no longer `pending`. The
   * matching wallet is also pessimistic-locked so concurrent admin
   * approvals can't double-spend.
   */
  async approve(requestId: string, actorId: string, adminNote?: string) {
    return this.dataSource.transaction(async (tx) => {
      const reqRepo = tx.getRepository(WalletRequest);
      const walletRepo = tx.getRepository(Wallet);
      const txRepo = tx.getRepository(WalletTransaction);
      const auditRepo = tx.getRepository(AdminAction);

      const request = await reqRepo
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: requestId })
        .getOne();
      if (!request) {
        throw new NotFoundException('Demande introuvable');
      }
      if (request.status !== WalletRequestStatus.PENDING) {
        throw new BadRequestException('Cette demande a déjà été traitée');
      }

      const wallet = await walletRepo
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.user_id = :id', { id: request.user_id })
        .getOne();
      if (!wallet) {
        throw new NotFoundException('Wallet introuvable');
      }

      let txType: WalletTransactionType;
      let txAmount: number;
      let action: string;

      if (request.type === WalletRequestType.DEPOSIT) {
        wallet.balance_xpf += request.amount_xpf;
        txType = WalletTransactionType.CREDIT;
        txAmount = request.amount_xpf;
        action = 'wallet.deposit.approve';
      } else {
        if (wallet.balance_xpf < request.amount_xpf) {
          throw new BadRequestException(
            `Solde insuffisant : ${wallet.balance_xpf} XPF disponible, ${request.amount_xpf} XPF demandé`,
          );
        }
        wallet.balance_xpf -= request.amount_xpf;
        txType = WalletTransactionType.DEBIT;
        txAmount = -request.amount_xpf;
        action = 'wallet.payout.approve';
      }

      await walletRepo.save(wallet);

      await txRepo.save(
        txRepo.create({
          user_id: request.user_id,
          amount_xpf: txAmount,
          type: txType,
          trip_id: null,
          actor_user_id: actorId,
          reason:
            request.type === WalletRequestType.DEPOSIT
              ? 'Dépôt par virement validé'
              : 'Retrait par virement validé',
          wallet_request_id: request.id,
        }),
      );

      request.status = WalletRequestStatus.APPROVED;
      request.processed_by_user_id = actorId;
      request.processed_at = new Date();
      if (adminNote && adminNote.trim()) {
        request.admin_note = adminNote.trim();
      }
      const saved = await reqRepo.save(request);

      await auditRepo.save(
        auditRepo.create({
          actor_user_id: actorId,
          action,
          target_type: 'wallet_request',
          target_id: request.id,
          payload: {
            user_id: request.user_id,
            amount_xpf: request.amount_xpf,
            balance_after_xpf: wallet.balance_xpf,
            iban: request.iban,
            admin_note: request.admin_note,
          },
        }),
      );

      this.notifyUpdate(saved);

      return this.toDto(saved);
    });
  }

  async reject(requestId: string, actorId: string, adminNote: string) {
    if (!adminNote || adminNote.trim().length < 3) {
      throw new BadRequestException(
        'Une raison de rejet est requise (3 caractères minimum)',
      );
    }
    return this.dataSource.transaction(async (tx) => {
      const reqRepo = tx.getRepository(WalletRequest);
      const auditRepo = tx.getRepository(AdminAction);

      const request = await reqRepo
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: requestId })
        .getOne();
      if (!request) {
        throw new NotFoundException('Demande introuvable');
      }
      if (request.status !== WalletRequestStatus.PENDING) {
        throw new BadRequestException('Cette demande a déjà été traitée');
      }

      request.status = WalletRequestStatus.REJECTED;
      request.processed_by_user_id = actorId;
      request.processed_at = new Date();
      request.admin_note = adminNote.trim();
      const saved = await reqRepo.save(request);

      await auditRepo.save(
        auditRepo.create({
          actor_user_id: actorId,
          action:
            request.type === WalletRequestType.DEPOSIT
              ? 'wallet.deposit.reject'
              : 'wallet.payout.reject',
          target_type: 'wallet_request',
          target_id: request.id,
          payload: {
            user_id: request.user_id,
            amount_xpf: request.amount_xpf,
            iban: request.iban,
            admin_note: request.admin_note,
          },
        }),
      );

      void this.audit;
      this.notifyUpdate(saved);

      return this.toDto(saved);
    });
  }

  private notifyUpdate(req: WalletRequest): void {
    const dto = this.toDto(req);
    this.bus.emitToUser(req.user_id, 'wallet:request:updated', dto);
    this.bus.emitToRole('admin', 'wallet:request:updated', dto);
    void this.broadcastPendingCount();
  }

  private async broadcastPendingCount(): Promise<void> {
    try {
      const { count } = await this.pendingCount();
      this.bus.emitToRole('admin', 'wallet:request:pending-count', { count });
    } catch {
      // best-effort; failures of the badge are non-fatal
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
