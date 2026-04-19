import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ListQueryDto } from './list-query.dto';

export class AuditListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsString()
  action?: string;
}
