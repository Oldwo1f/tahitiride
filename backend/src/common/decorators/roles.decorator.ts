import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../types/direction.enum';

export const ROLES_KEY = 'roles';

/**
 * Restrict a controller or handler to a set of `UserRole`s. Must be used in
 * combination with `JwtAuthGuard` AND `RolesGuard`. Without `JwtAuthGuard` no
 * `request.user` is populated and the roles guard will deny everything.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
