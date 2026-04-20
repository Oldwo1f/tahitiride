import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/types/direction.enum';
import { User } from '../../entities/user.entity';

interface CachedRole {
  role: UserRole;
  is_driver: boolean;
  suspended: boolean;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;

/**
 * Guard that re-checks the caller's role against the database. The role
 * embedded in the JWT may be stale (a JWT lives for 24h by default), so we
 * cannot trust it for sensitive admin endpoints — we re-fetch with a small
 * in-process cache so we don't hammer the DB on every request.
 *
 * Always combine with `JwtAuthGuard` (this guard reads `request.user`).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly cache = new Map<string, CachedRole>();

  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const principal = req.user;
    if (!principal?.id) {
      throw new UnauthorizedException();
    }

    const fresh = await this.resolveFreshRole(principal.id);
    if (!fresh) {
      throw new UnauthorizedException();
    }
    if (fresh.suspended) {
      throw new ForbiddenException('Account suspended');
    }
    if (!required.includes(fresh.role)) {
      throw new ForbiddenException('Insufficient role');
    }

    principal.role = fresh.role;
    principal.is_driver = fresh.is_driver;
    return true;
  }

  private async resolveFreshRole(userId: string): Promise<CachedRole | null> {
    const now = Date.now();
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > now) {
      return cached;
    }

    const row = await this.users.findOne({
      where: { id: userId },
      select: ['id', 'role', 'is_driver', 'suspended_at', 'deleted_at'],
    });
    if (!row || row.deleted_at) {
      this.cache.delete(userId);
      return null;
    }

    const entry: CachedRole = {
      role: row.role,
      is_driver: !!row.is_driver,
      suspended: !!row.suspended_at,
      expiresAt: now + CACHE_TTL_MS,
    };
    this.cache.set(userId, entry);
    return entry;
  }
}
