import { IsNumber, IsString, Max, Min } from 'class-validator';

export class PickupDto {
  @IsString()
  qr_token!: string;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;
}

/**
 * Sent by the passenger asking to step out of the vehicle, and by the
 * driver when they confirm/decide a passenger has left. We just need the
 * current GPS fix; the QR is no longer scanned at dropoff (the QR is now
 * only used to start the trip).
 */
export class DropoffPositionDto {
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;
}
