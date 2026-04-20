import { IsBoolean } from 'class-validator';

/**
 * PATCH /admin/users/:id/driver-mode payload. Admins can force the
 * driver-mode flag on any user regardless of their role; the endpoint
 * does not verify vehicle ownership so back-office staff can
 * provision or disable the capability at will (e.g. after a manual
 * approval or to pause a misbehaving driver).
 */
export class UpdateUserDriverModeDto {
  @IsBoolean()
  is_driver!: boolean;
}
