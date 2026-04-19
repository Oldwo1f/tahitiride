import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Form fields posted alongside the (optional) photo file at
 * `POST /api/vehicles/mine`. The driver onboarding wizard pre-fills
 * these from `POST /api/vehicles/photo/analyze` so the user mostly
 * just confirms — but they can edit before submitting (and OCR may
 * fail entirely on bad photos, in which case the user types them in).
 */
export class CreateVehicleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  plate!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  model!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  color!: string;
}
