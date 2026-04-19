import { IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../../../common/types/direction.enum';
import { ListQueryDto } from './list-query.dto';

export class UsersListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
