import * as bcrypt from 'bcrypt';
import { UserRole } from '../../../common/types/direction.enum';
import type { User } from '../../../entities/user.entity';
import { BootstrapAdminService } from './bootstrap-admin.service';

interface RepoState {
  users: User[];
  wallets: { user_id: string; balance_xpf: number }[];
}

function buildService(state: RepoState): BootstrapAdminService {
  const userRepo = {
    findOne: jest
      .fn()
      .mockImplementation(({ where }: { where: { email: string } }) =>
        Promise.resolve(
          state.users.find((u) => u.email === where.email) ?? null,
        ),
      ),
    save: jest.fn().mockImplementation((u: User) => {
      const i = state.users.findIndex((x) => x.id === u.id);
      if (i >= 0) state.users[i] = u;
      else state.users.push(u);
      return Promise.resolve(u);
    }),
    create: jest.fn().mockImplementation((u: Partial<User>) => ({
      id: 'new-id',
      ...u,
    })),
  };
  const walletRepo = {
    findOne: jest
      .fn()
      .mockImplementation(({ where }: { where: { user_id: string } }) =>
        Promise.resolve(
          state.wallets.find((w) => w.user_id === where.user_id) ?? null,
        ),
      ),
    save: jest.fn().mockImplementation((w: { user_id: string; balance_xpf: number }) => {
      state.wallets.push(w);
      return Promise.resolve(w);
    }),
    create: jest.fn().mockImplementation((w) => w),
  };
  const tx = {
    getRepository: jest.fn().mockImplementation((entity: { name?: string }) => {
      if (entity.name === 'User') return userRepo;
      if (entity.name === 'Wallet') return walletRepo;
      throw new Error('unexpected repo');
    }),
  };
  const dataSource = {
    transaction: jest
      .fn()
      .mockImplementation(<T>(cb: (mgr: typeof tx) => Promise<T>) => cb(tx)),
  };
  return new BootstrapAdminService(
    userRepo as never,
    { get: jest.fn() } as never,
    dataSource as never,
  );
}

describe('BootstrapAdminService.upsert', () => {
  it('creates a fresh admin with a 0-balance wallet when the email is new', async () => {
    const state: RepoState = { users: [], wallets: [] };
    const service = buildService(state);
    const result = await service.upsert({
      email: 'ops@example.com',
      password: 'verysecret123',
      fullName: 'Ops Admin',
    });
    expect(result.created).toBe(true);
    expect(result.promoted).toBe(false);
    expect(state.users).toHaveLength(1);
    expect(state.users[0]?.role).toBe(UserRole.ADMIN);
    expect(state.users[0]?.email).toBe('ops@example.com');
    expect(state.wallets).toHaveLength(1);
    expect(state.wallets[0]?.balance_xpf).toBe(0);
    expect(
      await bcrypt.compare('verysecret123', state.users[0]!.password_hash),
    ).toBe(true);
  });

  it('refuses to create a new admin without a password', async () => {
    const state: RepoState = { users: [], wallets: [] };
    const service = buildService(state);
    await expect(
      service.upsert({ email: 'ops@example.com' }),
    ).rejects.toThrow(/password is required/i);
    expect(state.users).toHaveLength(0);
  });

  it('promotes an existing non-admin user to admin (idempotent on the rest)', async () => {
    const state: RepoState = {
      users: [
        {
          id: 'u1',
          email: 'foo@bar.com',
          full_name: 'Foo',
          phone: null,
          password_hash: 'kept',
          role: UserRole.PASSENGER,
          suspended_at: null,
          deleted_at: null,
        } as unknown as User,
      ],
      wallets: [{ user_id: 'u1', balance_xpf: 9999 }],
    };
    const service = buildService(state);
    const result = await service.upsert({ email: 'foo@bar.com' });
    expect(result.created).toBe(false);
    expect(result.promoted).toBe(true);
    expect(state.users[0]?.role).toBe(UserRole.ADMIN);
    expect(state.users[0]?.password_hash).toBe('kept');
    expect(state.wallets).toHaveLength(1);
  });

  it('is a no-op when the user is already admin and no password is provided', async () => {
    const state: RepoState = {
      users: [
        {
          id: 'u1',
          email: 'foo@bar.com',
          full_name: 'Foo',
          phone: null,
          password_hash: 'kept',
          role: UserRole.ADMIN,
          suspended_at: null,
          deleted_at: null,
        } as unknown as User,
      ],
      wallets: [{ user_id: 'u1', balance_xpf: 0 }],
    };
    const service = buildService(state);
    const result = await service.upsert({ email: 'foo@bar.com' });
    expect(result.created).toBe(false);
    expect(result.promoted).toBe(false);
    expect(result.passwordReset).toBe(false);
  });

  it('rotates the password when explicitly provided for an existing admin', async () => {
    const state: RepoState = {
      users: [
        {
          id: 'u1',
          email: 'foo@bar.com',
          full_name: 'Foo',
          phone: null,
          password_hash: 'old',
          role: UserRole.ADMIN,
          suspended_at: null,
          deleted_at: null,
        } as unknown as User,
      ],
      wallets: [{ user_id: 'u1', balance_xpf: 0 }],
    };
    const service = buildService(state);
    const result = await service.upsert({
      email: 'foo@bar.com',
      password: 'rotated-secret',
    });
    expect(result.passwordReset).toBe(true);
    expect(
      await bcrypt.compare('rotated-secret', state.users[0]!.password_hash),
    ).toBe(true);
  });

  it('revives a soft-deleted account and restores admin role', async () => {
    const state: RepoState = {
      users: [
        {
          id: 'u1',
          email: 'foo@bar.com',
          full_name: 'Foo',
          phone: null,
          password_hash: 'kept',
          role: UserRole.PASSENGER,
          suspended_at: new Date(),
          deleted_at: new Date(),
        } as unknown as User,
      ],
      wallets: [{ user_id: 'u1', balance_xpf: 0 }],
    };
    const service = buildService(state);
    const result = await service.upsert({ email: 'foo@bar.com' });
    expect(result.promoted).toBe(true);
    expect(state.users[0]?.deleted_at).toBeNull();
    expect(state.users[0]?.suspended_at).toBeNull();
    expect(state.users[0]?.role).toBe(UserRole.ADMIN);
  });
});
