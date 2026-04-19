import { IsISO8601, IsOptional } from 'class-validator';

export class ApproveCertificationDto {
  /**
   * Optional override for the OCR-extracted expiry date. When omitted,
   * the existing `expires_at` (set at submission time) is kept. Format
   * is ISO 8601 date (`YYYY-MM-DD`).
   */
  @IsOptional()
  @IsISO8601({ strict: true })
  expires_at?: string;
}
