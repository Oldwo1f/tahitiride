import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
  OcrInsuranceExtraction,
  OcrLicenseExtraction,
  OcrProvider,
} from './ocr-provider.interface';

const DEFAULT_MODEL = 'gpt-4o-mini';

const LICENSE_PROMPT = `Tu es un système d'extraction de données pour permis de conduire français (et polynésien).
À partir de l'image, retourne UNIQUEMENT un objet JSON avec les clés suivantes :
- "name": chaîne unique "Prénom Nom" telle qu'imprimée sur le permis (ou null si illisible).
- "expires_at": date de fin de validité du document au format ISO YYYY-MM-DD (ou null si absente).
- "confidence": nombre entre 0 et 1 indiquant ta confiance globale dans l'extraction.
- "notes": brève explication en français si confidence < 0.8 (sinon null).

Règles strictes :
- Pas de texte hors du JSON.
- Si le document n'est PAS un permis de conduire, mets confidence=0 et notes="Document non reconnu comme permis".
- Pour les dates : convertis "JJ/MM/AAAA" en "AAAA-MM-JJ".`;

const INSURANCE_PROMPT = `Tu es un système d'extraction de données pour vignettes / attestations d'assurance auto (FR / Polynésie française).
À partir de l'image, retourne UNIQUEMENT un objet JSON avec les clés suivantes :
- "plate": immatriculation du véhicule en majuscules sans espace (ou null).
- "expires_at": date de fin de validité de l'assurance au format ISO YYYY-MM-DD (ou null).
- "confidence": nombre entre 0 et 1 indiquant ta confiance globale.
- "notes": brève explication en français si confidence < 0.8 (sinon null).

Règles strictes :
- Pas de texte hors du JSON.
- Pour les dates : convertis "JJ/MM/AAAA" en "AAAA-MM-JJ".
- Si le document ne ressemble PAS à une vignette/attestation d'assurance, mets confidence=0 et notes="Document non reconnu comme vignette d'assurance".`;

interface RawJsonResponse {
  name?: string | null;
  plate?: string | null;
  expires_at?: string | null;
  confidence?: number | null;
  notes?: string | null;
}

/**
 * Production OCR provider backed by OpenAI's vision-capable chat models
 * (defaults to `gpt-4o-mini`, ~$0.001 per call). Designed to be swapped
 * via the `OCR_PROVIDER` DI token if the team migrates to a dedicated
 * permit/insurance API later.
 */
@Injectable()
export class OpenAiVisionOcrProvider implements OcrProvider {
  private readonly logger = new Logger(OpenAiVisionOcrProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      // Constructed by the factory only when the key is set, but we
      // keep a defensive log here for debugging mis-wired DI.
      this.logger.warn(
        'OpenAiVisionOcrProvider instantiated without OPENAI_API_KEY',
      );
    }
    this.client = new OpenAI({ apiKey: apiKey ?? '' });
    this.model = config.get<string>('OPENAI_VISION_MODEL') || DEFAULT_MODEL;
  }

  async extractLicense(
    buffer: Buffer,
    mime: string,
  ): Promise<OcrLicenseExtraction> {
    const raw = await this.callVision(LICENSE_PROMPT, buffer, mime);
    return {
      name: typeof raw?.name === 'string' ? raw.name.trim() : null,
      expires_at: this.normaliseDate(raw?.expires_at),
      confidence: this.clampConfidence(raw?.confidence),
      decision_notes: typeof raw?.notes === 'string' ? raw.notes : null,
      raw,
    };
  }

  async extractInsurance(
    buffer: Buffer,
    mime: string,
  ): Promise<OcrInsuranceExtraction> {
    const raw = await this.callVision(INSURANCE_PROMPT, buffer, mime);
    return {
      plate:
        typeof raw?.plate === 'string'
          ? raw.plate.replace(/[^A-Z0-9]/gi, '').toUpperCase() || null
          : null,
      expires_at: this.normaliseDate(raw?.expires_at),
      confidence: this.clampConfidence(raw?.confidence),
      decision_notes: typeof raw?.notes === 'string' ? raw.notes : null,
      raw,
    };
  }

  private async callVision(
    systemPrompt: string,
    buffer: Buffer,
    mime: string,
  ): Promise<RawJsonResponse | null> {
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    const completion = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Voici le document. Extrais les champs demandés.',
            },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
      temperature: 0,
      max_completion_tokens: 500,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      this.logger.warn('OpenAI vision returned empty content');
      return null;
    }

    try {
      return JSON.parse(text) as RawJsonResponse;
    } catch (err) {
      this.logger.warn(
        `OpenAI vision returned invalid JSON: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private clampConfidence(input: unknown): number {
    const n = typeof input === 'number' ? input : Number(input);
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }

  private normaliseDate(input: unknown): string | null {
    if (typeof input !== 'string' || !input) return null;
    const trimmed = input.trim();
    // Already ISO 8601 (YYYY-MM-DD) — accept and validate.
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (isoMatch) {
      const d = new Date(trimmed);
      return Number.isNaN(d.getTime()) ? null : trimmed;
    }
    // French DD/MM/YYYY — convert.
    const frMatch = /^(\d{2})[/.](\d{2})[/.](\d{4})$/.exec(trimmed);
    if (frMatch) {
      const [, dd, mm, yyyy] = frMatch;
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }
}
