import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AdminAction } from '../../../entities/admin-action.entity';
import type { AuditListQueryDto } from '../dto/audit-list-query.dto';

export interface RecordParams {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  payload?: Record<string, unknown>;
}

@Injectable()
export class AdminAuditService {
  constructor(
    @InjectRepository(AdminAction)
    private readonly repo: Repository<AdminAction>,
  ) {}

  /**
   * Append a row to the audit log. Always call inside the same transaction
   * as the privileged action whenever possible — pass `manager` to opt into
   * the existing transaction, otherwise the record uses its own connection.
   */
  async record(
    params: RecordParams,
    manager?: EntityManager,
  ): Promise<AdminAction> {
    const repo = manager ? manager.getRepository(AdminAction) : this.repo;
    const row = repo.create({
      actor_user_id: params.actorId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId ?? null,
      payload: params.payload ?? {},
    });
    return repo.save(row);
  }

  async list(query: AuditListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const qb = this.repo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.actor', 'actor')
      .orderBy('a.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    if (query.actorId) {
      qb.andWhere('a.actor_user_id = :actorId', { actorId: query.actorId });
    }
    if (query.action) {
      qb.andWhere('a.action = :action', { action: query.action });
    }
    const [rows, total] = await qb.getManyAndCount();
    return {
      total,
      page,
      pageSize,
      items: rows.map((r) => ({
        id: r.id,
        actor_user_id: r.actor_user_id,
        actor_email: r.actor?.email ?? null,
        action: r.action,
        target_type: r.target_type,
        target_id: r.target_id,
        payload: r.payload,
        created_at: r.created_at,
      })),
    };
  }
}
