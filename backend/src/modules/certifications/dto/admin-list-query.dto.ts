import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  CertificationStatus,
  CertificationType,
} from '../../../entities/certification.entity';

export class AdminCertificationListQueryDto {
  @IsOptional()
  @IsEnum(CertificationStatus)
  status?: CertificationStatus;

  @IsOptional()
  @IsEnum(CertificationType)
  type?: CertificationType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
