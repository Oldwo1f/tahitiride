import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserRole } from '../../common/types/direction.enum';
import { User } from '../../entities/user.entity';
import { Vehicle } from '../../entities/vehicle.entity';
import { UploadsService } from '../uploads/uploads.service';
import { UsersService } from './users.service';

interface UserRow extends Partial<User> {
  id: string;
  is_driver: boolean;
  role: UserRole;
  deleted_at: Date | null;
}

function buildService(opts: {
  rows: UserRow[];
  vehicleCount?: number;
  onSave?: (user: User) => void;
}) {
  const findOne = jest
    .fn()
    .mockImplementation(({ where }: { where: { id: string } }) => {
      const row = opts.rows.find((r) => r.id === where.id);
      return Promise.resolve(row ?? null);
    });
  const save = jest.fn().mockImplementation((user: User) => {
    opts.onSave?.(user);
    return Promise.resolve(user);
  });
  const usersRepo = {
    findOne,
    save,
  } as unknown as Repository<User>;
  const count = jest.fn().mockResolvedValue(opts.vehicleCount ?? 0);
  const vehiclesRepo = {
    count,
  } as unknown as Repository<Vehicle>;
  const uploads = {
    store: jest.fn(),
  } as unknown as UploadsService;

  const service = new UsersService(usersRepo, vehiclesRepo, uploads);
  const getProfile = jest
    .spyOn(service, 'getProfile')
    .mockImplementation((userId: string) => {
      const row = opts.rows.find((r) => r.id === userId);
      if (!row) return Promise.reject(new NotFoundException());
      return Promise.resolve({
        id: row.id,
        email: 'e@x',
        phone: null,
        full_name: 'U',
        first_name: null,
        last_name: null,
        avatar_path: null,
        avatar_url: null,
        role: row.role,
        is_driver: !!row.is_driver,
        created_at: new Date(),
        suspended_at: null,
      });
    });
  return { service, save, count, findOne, getProfile };
}

describe('UsersService.setDriverMode', () => {
  it('throws NotFoundException when the user does not exist', async () => {
    const { service } = buildService({ rows: [] });
    await expect(service.setDriverMode('missing', true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('blocks activation without a vehicle with a BadRequestException', async () => {
    const { service, save } = buildService({
      rows: [
        {
          id: 'u1',
          role: UserRole.USER,
          is_driver: false,
          deleted_at: null,
        },
      ],
      vehicleCount: 0,
    });
    await expect(service.setDriverMode('u1', true)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('enables driver mode when a vehicle is already registered', async () => {
    const saved: boolean[] = [];
    const { service, save } = buildService({
      rows: [
        {
          id: 'u1',
          role: UserRole.USER,
          is_driver: false,
          deleted_at: null,
        },
      ],
      vehicleCount: 2,
      onSave: (u) => saved.push(!!u.is_driver),
    });
    const res = await service.setDriverMode('u1', true);
    expect(save).toHaveBeenCalledTimes(1);
    expect(saved).toEqual([true]);
    expect(res.is_driver).toBe(true);
  });

  it('disables driver mode without requiring a vehicle', async () => {
    const saved: boolean[] = [];
    const { service, save, count } = buildService({
      rows: [
        {
          id: 'u1',
          role: UserRole.USER,
          is_driver: true,
          deleted_at: null,
        },
      ],
      vehicleCount: 0,
      onSave: (u) => saved.push(!!u.is_driver),
    });
    const res = await service.setDriverMode('u1', false);
    expect(count).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
    expect(saved).toEqual([false]);
    expect(res.is_driver).toBe(false);
  });

  it('is idempotent when the flag is already in the desired state', async () => {
    const { service, save } = buildService({
      rows: [
        {
          id: 'u1',
          role: UserRole.ADMIN,
          is_driver: true,
          deleted_at: null,
        },
      ],
      vehicleCount: 1,
    });
    await service.setDriverMode('u1', true);
    expect(save).not.toHaveBeenCalled();
  });

  it('treats admins like any other user and lets them enable driver mode with a vehicle', async () => {
    const { service, save } = buildService({
      rows: [
        {
          id: 'u1',
          role: UserRole.ADMIN,
          is_driver: false,
          deleted_at: null,
        },
      ],
      vehicleCount: 1,
    });
    await service.setDriverMode('u1', true);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
