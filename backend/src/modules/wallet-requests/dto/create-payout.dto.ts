import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Body sent when a driver requests to be paid out.
 *
 * The IBAN regex is intentionally permissive (2 letters country, 2 check
 * digits, 11–30 alphanumerics) — the precise per-country length is
 * checked client-side. We strip whitespace before validating so the user
 * can paste an IBAN with the usual spaces.
 */
export class CreatePayoutDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount_xpf!: number;

  @IsString()
  @MinLength(15)
  @MaxLength(34)
  @Matches(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/, {
    message: 'IBAN format invalide',
  })
  iban!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  account_holder_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  user_note?: string;
}
