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
 * Result of analyzing a 3/4 face vehicle photo. Used to pre-fill the
 * vehicle creation form during the driver onboarding wizard so the user
 * mostly just confirms the data instead of typing it in.
 */
export interface OcrVehicleExtraction {
  /** Detected manufacturer (e.g. "Toyota", "Renault") or null. */
  make?: string | null;
  /** Detected model (e.g. "Corolla", "Clio") or null. */
  model?: string | null;
  /** Dominant body colour, in French (e.g. "blanc", "rouge") or null. */
  color?: string | null;
  /** Detected plate, uppercase, no spaces, or null. */
  plate?: string | null;
  /** 0..1 confidence reported by the model. */
  confidence?: number | null;
  /** Optional human-readable note from the model when confidence is low. */
  decision_notes?: string | null;
  /** Raw model response (kept for debugging / audit). */
  raw?: unknown;
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
  /**
   * Identifies a vehicle from a 3/4 face roadside photo. Used during
   * the driver onboarding wizard to pre-fill the vehicle creation form.
   */
  extractVehicle(buffer: Buffer, mime: string): Promise<OcrVehicleExtraction>;
}

/** DI token for the active OCR provider. */
export const OCR_PROVIDER = Symbol('OCR_PROVIDER');
