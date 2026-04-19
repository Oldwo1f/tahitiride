import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * The signup payload accepts either the legacy `full_name` field (so
 * older clients keep working) or the split `first_name` + `last_name`
 * pair. The auth service prefers the split fields when present and
 * falls back to splitting `full_name` on the first space otherwise.
 *
 * Role is no longer accepted from the client: every self-service signup
 * lands as `passenger`. Drivers go through the onboarding wizard from
 * `/profile` which auto-promotes the account to `both` once a vehicle
 * is created.
 */
export class SignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  full_name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  first_name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  last_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}
