import type { OcrExtractionResult } from '../../../entities/certification.entity';

export interface OcrLicenseExtraction extends OcrExtractionResult {
  /** Detected name on the driver license (full name, single string). */
  name?: string | null;
  /** Detected expiry date (ISO YYYY-MM-DD). */
  expires_at?: string | null;
}

export interface OcrInsuranceExtraction extends OcrExtractionResult {
  /** Detected vehicle plate (uppercase, no spaces). */
  plate?: string | null;
  /** Detected end-of-validity date (ISO YYYY-MM-DD). */
  expires_at?: string | null;
}

/**
 * Pluggable OCR provider used by `CertificationsService`. The default
 * implementation is `OpenAiVisionOcrProvider`; alternative engines
 * (Mindee, AWS Textract, on-prem model) can be swapped via the DI
 * `OCR_PROVIDER` token.
 */
export interface OcrProvider {
  /** Extracts structured fields from a French driver license photo. */
  extractLicense(buffer: Buffer, mime: string): Promise<OcrLicenseExtraction>;
  /** Extracts structured fields from an insurance vignette photo. */
  extractInsurance(
    buffer: Buffer,
    mime: string,
  ): Promise<OcrInsuranceExtraction>;
}

/** DI token for the active OCR provider. */
export const OCR_PROVIDER = Symbol('OCR_PROVIDER');
