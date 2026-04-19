import { Type } from 'class-transformer';
import {
  IsInt,
  IsString,
  MaxLength,
  MinLength,
  NotEquals,
} from 'class-validator';

/**
 * Signed delta to apply to a user's wallet. A positive number credits the
 * user, a negative one debits them. Zero is rejected (would create a noisy
 * audit row with no effect). The reason is stored on both the
 * `wallet_transactions` row and the `admin_actions` audit log.
 */
export class AdjustWalletDto {
  @Type(() => Number)
  @IsInt()
  @NotEquals(0)
  deltaXpf!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
