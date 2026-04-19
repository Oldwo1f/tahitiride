import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectCertificationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
