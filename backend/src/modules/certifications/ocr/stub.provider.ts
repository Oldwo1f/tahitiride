import { Injectable, Logger } from '@nestjs/common';
import type {
  OcrInsuranceExtraction,
  OcrLicenseExtraction,
  OcrProvider,
  OcrVehicleExtraction,
} from './ocr-provider.interface';

const STUB_NOTES = 'OCR désactivé (provider stub) — revue manuelle requise';

/**
 * Fallback provider used when no OCR backend is configured (e.g. local
 * dev without an OPENAI_API_KEY). Returns confidence 0 so every
 * submission lands in the admin review queue, which is the safest
 * default for a security-sensitive flow.
 */
@Injectable()
export class StubOcrProvider implements OcrProvider {
  private readonly logger = new Logger(StubOcrProvider.name);

  extractLicense(): Promise<OcrLicenseExtraction> {
    this.logger.warn(
      'StubOcrProvider in use: license extraction always defers to admin review',
    );
    return Promise.resolve({
      name: null,
      expires_at: null,
      confidence: 0,
      decision_notes: STUB_NOTES,
      raw: null,
    });
  }

  extractInsurance(): Promise<OcrInsuranceExtraction> {
    this.logger.warn(
      'StubOcrProvider in use: insurance extraction always defers to admin review',
    );
    return Promise.resolve({
      plate: null,
      expires_at: null,
      confidence: 0,
      decision_notes: STUB_NOTES,
      raw: null,
    });
  }

  extractVehicle(): Promise<OcrVehicleExtraction> {
    this.logger.warn(
      'StubOcrProvider in use: vehicle photo analysis returns empty fields',
    );
    return Promise.resolve({
      make: null,
      model: null,
      color: null,
      plate: null,
      confidence: 0,
      decision_notes:
        'OCR désactivé (provider stub) — saisis les champs manuellement',
      raw: null,
    });
  }
}
