import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds Facebook Login support to the `users` table:
 *
 * - `facebook_id` stores the stable Facebook user id returned by the
 *   Graph API (`/me`). It is nullable so existing email/password users
 *   stay untouched, and a partial unique index guarantees a Facebook
 *   account can be linked to at most one local user without forcing a
 *   value on every row.
 * - `password_hash` becomes nullable: a user signing in with Facebook
 *   for the first time has no local password until they explicitly set
 *   one. The login flow checks for null before invoking `bcrypt.compare`.
 */
export class FacebookAuth1713800000000 implements MigrationInterface {
  name = 'FacebookAuth1713800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "facebook_id" varchar(64)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_facebook_id" ON "users" ("facebook_id") WHERE "facebook_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-asserting NOT NULL would fail if any Facebook-only user exists,
    // so we backfill with an empty string first to keep the migration
    // reversible (those users could never log in again, which is the
    // expected behavior when removing Facebook support).
    await queryRunner.query(
      `UPDATE "users" SET "password_hash" = '' WHERE "password_hash" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_facebook_id"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "facebook_id"`,
    );
  }
}
