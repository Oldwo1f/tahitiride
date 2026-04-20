import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  /**
   * Driver-mode capability. Defaults to `false` when the field is
   * absent from the JWT (legacy tokens issued before the role
   * refactor) — guards that need a fresh value still re-read it
   * from the database.
   */
  is_driver: boolean;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return req.user;
  },
);
