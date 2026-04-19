import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TripStatus } from '../../../common/types/direction.enum';
import { ListQueryDto } from './list-query.dto';

export class TripsListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @Type(() => Number)
  override page?: number = 1;
}
