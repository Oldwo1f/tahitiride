import { IsNumber, Max, Min } from 'class-validator';

export class EstimateDto {
  @IsNumber()
  @Min(-180)
  @Max(180)
  from_lng!: number;

  @IsNumber()
  @Min(-90)
  @Max(90)
  from_lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  to_lng!: number;

  @IsNumber()
  @Min(-90)
  @Max(90)
  to_lat!: number;
}

export interface EstimateResponseDto {
  distance_m: number;
  duration_s: number;
  fare_xpf: number;
}
