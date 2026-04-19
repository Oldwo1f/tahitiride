import { join } from 'path';

export type UploadCategory = 'licenses' | 'insurance' | 'avatars';

export const UPLOAD_CATEGORIES: UploadCategory[] = [
  'licenses',
  'insurance',
  'avatars',
];

/**
 * Resolves the absolute filesystem root used for all uploads. Defaults to
 * `/app/uploads` (matching the Docker volume mount) and falls back to
 * `<cwd>/uploads` in local development.
 */
export function resolveUploadRoot(): string {
  const fromEnv = process.env.UPLOAD_DIR?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === 'production') return '/app/uploads';
  return join(process.cwd(), 'uploads');
}

export function categoryDir(category: UploadCategory): string {
  return join(resolveUploadRoot(), category);
}

/**
 * Builds the relative `category/filename` path that gets stored in the DB
 * (`certifications.file_path`, `users.avatar_path`). Keeping it relative
 * means the volume can be remounted at a different absolute path without
 * a data migration.
 */
export function relativeUploadPath(
  category: UploadCategory,
  filename: string,
): string {
  return `${category}/${filename}`;
}
