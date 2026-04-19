import { join } from 'path';

export type UploadCategory = 'licenses' | 'insurance' | 'avatars' | 'vehicles';

export const UPLOAD_CATEGORIES: UploadCategory[] = [
  'licenses',
  'insurance',
  'avatars',
  'vehicles',
];

/**
 * Categories that any authenticated user is allowed to download (no
 * ownership check). Currently:
 *   - `avatars`: peers see each other on the map / trip screens.
 *   - `vehicles`: passengers waiting on the side of the road need to
 *     recognise the car arriving (3/4 face photo captured during the
 *     driver onboarding wizard).
 */
export const PUBLIC_UPLOAD_CATEGORIES: ReadonlySet<UploadCategory> = new Set([
  'avatars',
  'vehicles',
]);

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
