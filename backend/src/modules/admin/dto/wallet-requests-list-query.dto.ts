import { IsEnum, IsOptional } from 'class-validator';
import {
  WalletRequestStatus,
  WalletRequestType,
} from '../../../common/types/direction.enum';
import { ListQueryDto } from './list-query.dto';

export class WalletRequestsListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(WalletRequestType)
  type?: WalletRequestType;

  @IsOptional()
  @IsEnum(WalletRequestStatus)
  status?: WalletRequestStatus;
}
