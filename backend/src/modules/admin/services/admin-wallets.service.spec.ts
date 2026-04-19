import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WalletTransactionType } from '../../../common/types/direction.enum';
import { AdminAction } from '../../../entities/admin-action.entity';
import { User } from '../../../entities/user.entity';
import { WalletTransaction } from '../../../entities/wallet-transaction.entity';
import { Wallet } from '../../../entities/wallet.entity';
import { AdminWalletsService } from './admin-wallets.service';

describe('AdminWalletsService.adjust', () => {
  let service: AdminWalletsService;
  let user: User;
  let wallet: Wallet;
  let savedTxRows: WalletTransaction[];
  let savedAdminActions: AdminAction[];
  let savedWallets: Wallet[];
  const actorId = '00000000-0000-0000-0000-00000000aaaa';
  const userId = '00000000-0000-0000-0000-00000000bbbb';

  beforeEach(() => {
    user = {
      id: userId,
      deleted_at: null,
    } as unknown as User;
    wallet = {
      user_id: userId,
      balance_xpf: 1000,
    } as unknown as Wallet;
    savedTxRows = [];
    savedAdminActions = [];
    savedWallets = [];

    const userRepo = {
      findOne: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve(where.id === userId ? user : null),
        ),
    };
    const walletQb = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockImplementation(() => Promise.resolve(wallet)),
    };
    const walletRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(walletQb),
      save: jest.fn().mockImplementation((w: Wallet) => {
        savedWallets.push(w);
        return Promise.resolve(w);
      }),
    };
    const txRepo = {
      create: jest.fn().mockImplementation((row: WalletTransaction) => row),
      save: jest.fn().mockImplementation((row: WalletTransaction) => {
        savedTxRows.push(row);
        return Promise.resolve(row);
      }),
    };
    const adminActionRepo = {
      create: jest.fn().mockImplementation((row: AdminAction) => row),
      save: jest.fn().mockImplementation((row: AdminAction) => {
        savedAdminActions.push(row);
        return Promise.resolve(row);
      }),
    };
    const tx = {
      getRepository: jest.fn().mockImplementation((entity: unknown) => {
        if (entity === User) return userRepo;
        if (entity === Wallet) return walletRepo;
        if (entity === WalletTransaction) return txRepo;
        if (entity === AdminAction) return adminActionRepo;
        throw new Error('Unexpected repo');
      }),
    };
    const dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(<T>(cb: (mgr: typeof tx) => Promise<T>) => cb(tx)),
    };

    service = new AdminWalletsService(
      walletRepo as never,
      txRepo as never,
      userRepo as never,
      dataSource as never,
      { record: jest.fn() } as never,
    );
  });

  it('credits a wallet and writes the wallet transaction + audit row', async () => {
    const result = await service.adjust({
      userId,
      deltaXpf: 500,
      reason: 'goodwill',
      actorId,
    });
    expect(result.balance_xpf).toBe(1500);
    expect(savedWallets[0]?.balance_xpf).toBe(1500);
    expect(savedTxRows).toHaveLength(1);
    expect(savedTxRows[0]).toMatchObject({
      user_id: userId,
      amount_xpf: 500,
      type: WalletTransactionType.ADJUSTMENT,
      actor_user_id: actorId,
      reason: 'goodwill',
    });
    expect(savedAdminActions).toHaveLength(1);
    expect(savedAdminActions[0]).toMatchObject({
      action: 'wallet.adjust',
      target_id: userId,
    });
  });

  it('debits a wallet within balance', async () => {
    const result = await service.adjust({
      userId,
      deltaXpf: -400,
      reason: 'refund taken back',
      actorId,
    });
    expect(result.balance_xpf).toBe(600);
    expect(savedTxRows[0]?.amount_xpf).toBe(-400);
  });

  it('refuses overdraft', async () => {
    await expect(
      service.adjust({
        userId,
        deltaXpf: -2000,
        reason: 'too much',
        actorId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(savedWallets).toHaveLength(0);
    expect(savedTxRows).toHaveLength(0);
    expect(savedAdminActions).toHaveLength(0);
  });

  it('refuses zero delta', async () => {
    await expect(
      service.adjust({ userId, deltaXpf: 0, reason: 'noop', actorId }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses non-integer delta', async () => {
    await expect(
      service.adjust({
        userId,
        deltaXpf: 1.5,
        reason: 'fractional',
        actorId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFound when user is missing', async () => {
    await expect(
      service.adjust({
        userId: '00000000-0000-0000-0000-00000000ffff',
        deltaXpf: 100,
        reason: 'x',
        actorId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound when user is soft-deleted', async () => {
    user.deleted_at = new Date();
    await expect(
      service.adjust({ userId, deltaXpf: 100, reason: 'x', actorId }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
