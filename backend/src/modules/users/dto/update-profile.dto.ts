import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * PATCH /api/users/me payload. All fields optional (partial update); we
 * recompute `full_name` server-side from `first_name + ' ' + last_name`
 * whenever either one is supplied.
 */
export class UpdateProfileDto {
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
