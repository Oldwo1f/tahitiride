import { IsEnum } from 'class-validator';
import { UserRole } from '../../../common/types/direction.enum';

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}
