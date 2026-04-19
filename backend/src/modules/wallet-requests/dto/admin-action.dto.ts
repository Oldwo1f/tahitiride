import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ApproveWalletRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  admin_note?: string;
}

export class RejectWalletRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  admin_note!: string;
}
