import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../../common/types/direction.enum';
import { User } from '../../../entities/user.entity';
import { AdminAuditService } from './admin-audit.service';

export interface AdminUsersListQuery {
  q?: string;
  role?: UserRole;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly audit: AdminAuditService,
  ) {}

  async list(query: AdminUsersListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const qb = this.users
      .createQueryBuilder('u')
      .leftJoin('wallets', 'w', 'w.user_id = u.id')
      .addSelect('w.balance_xpf', 'balance_xpf')
      .where('u.deleted_at IS NULL')
      .orderBy('u.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    if (query.q) {
      qb.andWhere('(u.email ILIKE :q OR u.full_name ILIKE :q)', {
        q: `%${query.q}%`,
      });
    }
    if (query.role) {
      qb.andWhere('u.role = :role', { role: query.role });
    }
    const total = await qb.getCount();
    const raw = await qb.getRawAndEntities();
    const items = raw.entities.map((u, idx) => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      phone: u.phone,
      role: u.role,
      created_at: u.created_at,
      suspended_at: u.suspended_at,
      balance_xpf: Number(raw.raw[idx]?.balance_xpf ?? 0),
    }));
    return { total, page, pageSize, items };
  }

  async getOne(id: string) {
    const user = await this.users.findOne({
      where: { id },
      relations: { vehicles: true, wallet: true },
    });
    if (!user || user.deleted_at) {
      throw new NotFoundException('User not found');
    }
    const { password_hash: _omit, ...rest } = user;
    void _omit;
    return rest;
  }

  async updateRole(id: string, role: UserRole, actorId: string) {
    if (id === actorId) {
      throw new BadRequestException('Cannot change your own role');
    }
    const user = await this.users.findOne({ where: { id } });
    if (!user || user.deleted_at) {
      throw new NotFoundException('User not found');
    }
    if (user.role === role) {
      return user;
    }
    const previous = user.role;
    user.role = role;
    await this.users.save(user);
    await this.audit.record({
      actorId,
      action: 'user.role.update',
      targetType: 'user',
      targetId: id,
      payload: { previous, next: role },
    });
    return user;
  }

  async setSuspended(id: string, suspended: boolean, actorId: string) {
    if (id === actorId) {
      throw new BadRequestException('Cannot suspend yourself');
    }
    const user = await this.users.findOne({ where: { id } });
    if (!user || user.deleted_at) {
      throw new NotFoundException('User not found');
    }
    if (user.role === UserRole.ADMIN && suspended) {
      throw new ForbiddenException('Cannot suspend another admin');
    }
    const wasSuspended = !!user.suspended_at;
    if (wasSuspended === suspended) {
      return user;
    }
    user.suspended_at = suspended ? new Date() : null;
    await this.users.save(user);
    await this.audit.record({
      actorId,
      action: suspended ? 'user.suspend' : 'user.unsuspend',
      targetType: 'user',
      targetId: id,
      payload: {},
    });
    return user;
  }

  async softDelete(id: string, actorId: string) {
    if (id === actorId) {
      throw new BadRequestException('Cannot delete yourself');
    }
    const user = await this.users.findOne({ where: { id } });
    if (!user || user.deleted_at) {
      throw new NotFoundException('User not found');
    }
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot delete another admin');
    }
    user.deleted_at = new Date();
    await this.users.save(user);
    await this.audit.record({
      actorId,
      action: 'user.delete',
      targetType: 'user',
      targetId: id,
      payload: { email: user.email },
    });
    return { ok: true };
  }
}
