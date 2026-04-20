import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserRole } from '../../../common/types/direction.enum';
import { User } from '../../../entities/user.entity';
import { AdminAuditService } from './admin-audit.service';
import { AdminUsersService } from './admin-users.service';

interface UserRow extends Partial<User> {
  id: string;
  role: UserRole;
  is_driver: boolean;
  deleted_at: Date | null;
  suspended_at: Date | null;
}

function buildService(rows: UserRow[]) {
  const savedUsers: User[] = [];
  const recordedAudits: Array<{
    action: string;
    payload: Record<string, unknown>;
    targetId: string;
    actorId: string;
  }> = [];
  const findOne = jest
    .fn()
    .mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(rows.find((r) => r.id === where.id) ?? null),
    );
  const save = jest.fn().mockImplementation((user: User) => {
    savedUsers.push(user);
    return Promise.resolve(user);
  });
  const usersRepo = {
    findOne,
    save,
    createQueryBuilder: jest.fn(),
  } as unknown as Repository<User>;
  const audit = {
    record: jest
      .fn()
      .mockImplementation(
        ({
          action,
          payload,
          targetId,
          actorId,
        }: {
          action: string;
          payload: Record<string, unknown>;
          targetId: string;
          actorId: string;
        }) => {
          recordedAudits.push({ action, payload, targetId, actorId });
          return Promise.resolve();
        },
      ),
  } as unknown as AdminAuditService;

  const service = new AdminUsersService(usersRepo, audit);
  return { service, savedUsers, recordedAudits, save };
}

describe('AdminUsersService.setDriverMode', () => {
  const actorId = '00000000-0000-0000-0000-000000000001';
  const targetId = '00000000-0000-0000-0000-000000000002';

  it('throws NotFoundException when the user does not exist', async () => {
    const { service } = buildService([]);
    await expect(
      service.setDriverMode(targetId, true, actorId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('flips is_driver from false to true and records `user.driver.enable` audit', async () => {
    const { service, savedUsers, recordedAudits } = buildService([
      {
        id: targetId,
        role: UserRole.USER,
        is_driver: false,
        deleted_at: null,
        suspended_at: null,
      },
    ]);
    await service.setDriverMode(targetId, true, actorId);
    expect(savedUsers).toHaveLength(1);
    expect(savedUsers[0]?.is_driver).toBe(true);
    expect(recordedAudits).toEqual([
      {
        action: 'user.driver.enable',
        payload: { is_driver: true },
        targetId,
        actorId,
      },
    ]);
  });

  it('flips is_driver from true to false and records `user.driver.disable` audit', async () => {
    const { service, savedUsers, recordedAudits } = buildService([
      {
        id: targetId,
        role: UserRole.USER,
        is_driver: true,
        deleted_at: null,
        suspended_at: null,
      },
    ]);
    await service.setDriverMode(targetId, false, actorId);
    expect(savedUsers).toHaveLength(1);
    expect(savedUsers[0]?.is_driver).toBe(false);
    expect(recordedAudits[0]?.action).toBe('user.driver.disable');
  });

  it('is idempotent and does not write an audit when the flag is unchanged', async () => {
    const { service, save, recordedAudits } = buildService([
      {
        id: targetId,
        role: UserRole.USER,
        is_driver: true,
        deleted_at: null,
        suspended_at: null,
      },
    ]);
    await service.setDriverMode(targetId, true, actorId);
    expect(save).not.toHaveBeenCalled();
    expect(recordedAudits).toHaveLength(0);
  });

  it('can enable driver mode on an admin (independent capability)', async () => {
    const { service, savedUsers, recordedAudits } = buildService([
      {
        id: targetId,
        role: UserRole.ADMIN,
        is_driver: false,
        deleted_at: null,
        suspended_at: null,
      },
    ]);
    await service.setDriverMode(targetId, true, actorId);
    expect(savedUsers[0]?.is_driver).toBe(true);
    expect(recordedAudits[0]?.action).toBe('user.driver.enable');
  });
});
