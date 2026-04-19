import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import {
  categoryDir,
  relativeUploadPath,
  resolveUploadRoot,
  UploadCategory,
  UPLOAD_CATEGORIES,
} from './upload-paths';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export interface StoredFile {
  /** `category/filename` relative path, ready to persist in DB. */
  relativePath: string;
  /** Absolute on-disk path for downstream consumers (e.g. OCR provider). */
  absolutePath: string;
  /** Raw bytes (kept in memory so the OCR call doesn't need to reload). */
  buffer: Buffer;
  mime: string;
}

/**
 * Centralises file persistence on the local volume. Multer is configured
 * with `memoryStorage` (small files, single per request) so this service
 * controls naming and validates MIME / size before writing to disk.
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor() {
    void this.ensureLayout();
  }

  private async ensureLayout(): Promise<void> {
    const root = resolveUploadRoot();
    try {
      for (const cat of UPLOAD_CATEGORIES) {
        await mkdir(join(root, cat), { recursive: true });
      }
    } catch (err) {
      this.logger.error(
        `Failed to create upload directories under ${root}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Persists a Multer-style file to disk under the given category. Returns
   * the relative path to store in the database plus the in-memory buffer
   * so the caller can hand it directly to the OCR provider.
   */
  async store(
    category: UploadCategory,
    file: Express.Multer.File | undefined,
  ): Promise<StoredFile> {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Fichier vide');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('Fichier trop volumineux (max 8 Mo)');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        'Format non supporté (jpeg, png ou webp uniquement)',
      );
    }

    await this.ensureLayout();

    const ext =
      MIME_TO_EXT[file.mimetype] || extname(file.originalname || '') || '.bin';
    const filename = `${randomUUID()}${ext}`;
    const absolutePath = join(categoryDir(category), filename);
    await writeFile(absolutePath, file.buffer);

    return {
      relativePath: relativeUploadPath(category, filename),
      absolutePath,
      buffer: file.buffer,
      mime: file.mimetype,
    };
  }
}
