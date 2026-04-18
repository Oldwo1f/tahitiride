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

export class DropoffDto {
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
