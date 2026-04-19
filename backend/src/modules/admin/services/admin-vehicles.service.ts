import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from '../../../entities/vehicle.entity';
import { AdminAuditService } from './admin-audit.service';

export interface AdminVehiclesListQuery {
  q?: string;
  userId?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AdminVehiclesService {
  constructor(
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    private readonly audit: AdminAuditService,
  ) {}

  async list(query: AdminVehiclesListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const qb = this.vehicles
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.user', 'u')
      .orderBy('v.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    if (query.q) {
      qb.andWhere(
        '(v.plate ILIKE :q OR v.model ILIKE :q OR v.color ILIKE :q OR u.email ILIKE :q OR u.full_name ILIKE :q)',
        { q: `%${query.q}%` },
      );
    }
    if (query.userId) {
      qb.andWhere('v.user_id = :uid', { uid: query.userId });
    }
    const [rows, total] = await qb.getManyAndCount();
    return {
      total,
      page,
      pageSize,
      items: rows.map((v) => ({
        id: v.id,
        plate: v.plate,
        model: v.model,
        color: v.color,
        created_at: v.created_at,
        user_id: v.user_id,
        owner_email: v.user?.email ?? null,
        owner_name: v.user?.full_name ?? null,
      })),
    };
  }

  async remove(id: string, actorId: string) {
    const vehicle = await this.vehicles.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    await this.vehicles.delete({ id });
    await this.audit.record({
      actorId,
      action: 'vehicle.delete',
      targetType: 'vehicle',
      targetId: id,
      payload: {
        plate: vehicle.plate,
        model: vehicle.model,
        owner_user_id: vehicle.user_id,
      },
    });
    return { ok: true };
  }
}
