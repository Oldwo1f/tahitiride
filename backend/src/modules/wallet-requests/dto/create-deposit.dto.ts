import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Body sent when a user clicks "J'ai effectué le virement".
 *
 * The amount is what the user *claims* they wired; the admin still
 * verifies it against the bank statement before approving and crediting
 * the wallet. `user_note` is meant for the bank reference / IBAN they
 * used (helps the admin reconcile faster).
 */
export class CreateDepositDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount_xpf!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  user_note?: string;
}
