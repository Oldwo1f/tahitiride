import { IsBoolean } from 'class-validator';

/**
 * PATCH /api/users/me/mode payload. The authenticated user flips their
 * own driver-mode flag (mode passager = `false`, mode conducteur =
 * `true`). When turning the mode on, `UsersService.setDriverMode`
 * rejects the request if no vehicle exists yet — the driver onboarding
 * wizard creates the first vehicle and promotes the user in one go, so
 * that case is already handled there.
 */
export class UpdateModeDto {
  @IsBoolean()
  is_driver!: boolean;
}
