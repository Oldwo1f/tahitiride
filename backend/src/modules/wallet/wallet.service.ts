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

  async settleTrip(params: {
    tripId: string;
    passengerId: string;
    driverId: string;
    fareXpf: number;
  }) {
    const { tripId, passengerId, driverId, fareXpf } = params;
    if (fareXpf <= 0) {
      throw new BadRequestException('Invalid fare');
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

      passengerWallet.balance_xpf -= actualFare;
      driverWallet.balance_xpf += actualFare;
      await walletRepo.save(passengerWallet);
      await walletRepo.save(driverWallet);

      await txRepo.save([
        txRepo.create({
          user_id: passengerId,
          amount_xpf: -actualFare,
          type: WalletTransactionType.DEBIT,
          trip_id: tripId,
        }),
        txRepo.create({
          user_id: driverId,
          amount_xpf: actualFare,
          type: WalletTransactionType.CREDIT,
          trip_id: tripId,
        }),
      ]);

      return { debited: actualFare, remaining: passengerWallet.balance_xpf };
    });
  }
}
