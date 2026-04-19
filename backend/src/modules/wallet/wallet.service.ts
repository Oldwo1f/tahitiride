import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WalletTransactionType } from '../../common/types/direction.enum';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { Wallet } from '../../entities/wallet.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly txs: Repository<WalletTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  async getMine(userId: string) {
    const w = await this.wallets.findOne({ where: { user_id: userId } });
    return { balance_xpf: w?.balance_xpf ?? 0 };
  }

  listTransactions(userId: string, limit = 50) {
    return this.txs.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  /**
   * Move money for a completed trip:
   *   - debit the passenger up to `fareXpf` (capped at their available
   *     balance, no overdraft),
   *   - credit the driver their `driverShareXpf` share, capped at what was
   *     actually collected from the passenger,
   *   - the remainder (fare minus driver share) is the platform margin —
   *     it stays out of any user wallet by design.
   *
   * The driver is paid in priority over the platform margin: if the
   * passenger could not cover the full fare, what little they did pay is
   * forwarded to the driver first; the platform absorbs the shortfall.
   */
  async settleTrip(params: {
    tripId: string;
    passengerId: string;
    driverId: string;
    fareXpf: number;
    driverShareXpf: number;
  }) {
    const { tripId, passengerId, driverId, fareXpf, driverShareXpf } = params;
    if (fareXpf <= 0) {
      throw new BadRequestException('Invalid fare');
    }
    if (driverShareXpf < 0 || driverShareXpf > fareXpf) {
      throw new BadRequestException('Invalid driver share');
    }

    return this.dataSource.transaction(async (tx) => {
      const walletRepo = tx.getRepository(Wallet);
      const txRepo = tx.getRepository(WalletTransaction);

      const passengerWallet = await walletRepo
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.user_id = :id', { id: passengerId })
        .getOne();
      const driverWallet = await walletRepo
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.user_id = :id', { id: driverId })
        .getOne();

      if (!passengerWallet || !driverWallet) {
        throw new BadRequestException('Missing wallet(s)');
      }

      const actualFare = Math.min(fareXpf, passengerWallet.balance_xpf);
      const driverCredit = Math.min(driverShareXpf, actualFare);
      const platformMargin = actualFare - driverCredit;

      passengerWallet.balance_xpf -= actualFare;
      driverWallet.balance_xpf += driverCredit;
      await walletRepo.save(passengerWallet);
      if (driverCredit > 0) {
        await walletRepo.save(driverWallet);
      }

      const rows: WalletTransaction[] = [
        txRepo.create({
          user_id: passengerId,
          amount_xpf: -actualFare,
          type: WalletTransactionType.DEBIT,
          trip_id: tripId,
        }),
      ];
      if (driverCredit > 0) {
        rows.push(
          txRepo.create({
            user_id: driverId,
            amount_xpf: driverCredit,
            type: WalletTransactionType.CREDIT,
            trip_id: tripId,
          }),
        );
      }
      await txRepo.save(rows);

      return {
        debited: actualFare,
        driverCredited: driverCredit,
        platformMargin,
        remaining: passengerWallet.balance_xpf,
      };
    });
  }
}
