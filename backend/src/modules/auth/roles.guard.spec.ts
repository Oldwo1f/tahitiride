import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../common/types/direction.enum';
import { RolesGuard } from './roles.guard';

interface UserRow {
  id: string;
  role: UserRole;
  suspended_at: Date | null;
  deleted_at: Date | null;
}

function buildContext(user: { id: string; role: string } | null): ExecutionContext {
  const req = { user: user ?? undefined };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function buildGuard(opts: {
  required: UserRole[] | undefined;
  rows: UserRow[];
  countSpy?: jest.Mock;
}): RolesGuard {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(opts.required),
  } as unknown as Reflector;
  const findOne = opts.countSpy ?? jest.fn();
  findOne.mockImplementation(({ where }: { where: { id: string } }) => {
    const row = opts.rows.find((r) => r.id === where.id);
    return Promise.resolve(row ?? null);
  });
  const repo = { findOne } as never;
  return new RolesGuard(reflector, repo);
}

describe('RolesGuard', () => {
  it('allows when no @Roles metadata is present', async () => {
    const guard = buildGuard({ required: undefined, rows: [] });
    await expect(
      guard.canActivate(buildContext({ id: 'x', role: 'whatever' })),
    ).resolves.toBe(true);
  });

  it('throws Unauthorized when no user is attached to the request', async () => {
    const guard = buildGuard({ required: [UserRole.ADMIN], rows: [] });
    await expect(
      guard.canActivate(buildContext(null)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when the DB role does not match the required set', async () => {
    const guard = buildGuard({
      required: [UserRole.ADMIN],
      rows: [
        {
          id: 'u1',
          role: UserRole.PASSENGER,
          suspended_at: null,
          deleted_at: null,
        },
      ],
    });
    await expect(
      guard.canActivate(buildContext({ id: 'u1', role: 'admin' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects suspended accounts even with the correct role', async () => {
    const guard = buildGuard({
      required: [UserRole.ADMIN],
      rows: [
        {
          id: 'u1',
          role: UserRole.ADMIN,
          suspended_at: new Date(),
          deleted_at: null,
        },
      ],
    });
    await expect(
      guard.canActivate(buildContext({ id: 'u1', role: 'admin' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('treats soft-deleted accounts as non-existent (Unauthorized)', async () => {
    const guard = buildGuard({
      required: [UserRole.ADMIN],
      rows: [
        {
          id: 'u1',
          role: UserRole.ADMIN,
          suspended_at: null,
          deleted_at: new Date(),
        },
      ],
    });
    await expect(
      guard.canActivate(buildContext({ id: 'u1', role: 'admin' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('caches the DB lookup for ~30s', async () => {
    const findOne = jest.fn();
    const guard = buildGuard({
      required: [UserRole.ADMIN],
      rows: [
        {
          id: 'u1',
          role: UserRole.ADMIN,
          suspended_at: null,
          deleted_at: null,
        },
      ],
      countSpy: findOne,
    });
    await guard.canActivate(buildContext({ id: 'u1', role: 'admin' }));
    await guard.canActivate(buildContext({ id: 'u1', role: 'admin' }));
    expect(findOne).toHaveBeenCalledTimes(1);
  });

  it('passes when the DB role matches and account is healthy', async () => {
    const guard = buildGuard({
      required: [UserRole.ADMIN],
      rows: [
        {
          id: 'u1',
          role: UserRole.ADMIN,
          suspended_at: null,
          deleted_at: null,
        },
      ],
    });
    await expect(
      guard.canActivate(buildContext({ id: 'u1', role: 'admin' })),
    ).resolves.toBe(true);
  });
});
