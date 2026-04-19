import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the certification system:
 *
 *   - `users.first_name`, `users.last_name`, `users.avatar_path` columns.
 *     `full_name` is kept (recomputed on update) so the existing modules
 *     (auth, admin, realtime) keep working unchanged. Existing rows are
 *     backfilled by splitting `full_name` on the first space.
 *
 *   - `vehicles.is_certified`, `vehicles.certified_until` denormalised cache
 *     columns (the source of truth lives in `certifications` rows).
 *
 *   - `certifications` table: one row per submitted document (driver license
 *     or insurance vignette). Status moves through `pending_ocr` →
 *     (`pending_review` | `approved` | `rejected`) → `expired`.
 */
export class Certifications1713500000000 implements MigrationInterface {
  name = 'Certifications1713500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "first_name" varchar(80),
        ADD COLUMN IF NOT EXISTS "last_name" varchar(80),
        ADD COLUMN IF NOT EXISTS "avatar_path" varchar(255)
    `);

    // Backfill first_name / last_name from full_name where empty. We split
    // on the first space: "Jean Dupont" → first="Jean", last="Dupont".
    // Single-token names go entirely into last_name (heuristic, admin can
    // fix later via /profile).
    await queryRunner.query(`
      UPDATE "users"
      SET
        "first_name" = COALESCE(
          NULLIF(SPLIT_PART(TRIM("full_name"), ' ', 1), ''),
          ''
        ),
        "last_name" = COALESCE(
          NULLIF(
            TRIM(SUBSTRING(
              TRIM("full_name")
              FROM POSITION(' ' IN TRIM("full_name")) + 1
            )),
            ''
          ),
          TRIM("full_name")
        )
      WHERE "first_name" IS NULL OR "last_name" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "vehicles"
        ADD COLUMN IF NOT EXISTS "is_certified" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "certified_until" date
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'certifications_type_enum'
        ) THEN
          CREATE TYPE "public"."certifications_type_enum"
            AS ENUM ('license','insurance');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'certifications_status_enum'
        ) THEN
          CREATE TYPE "public"."certifications_status_enum"
            AS ENUM ('pending_ocr','pending_review','approved','rejected','expired');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "certifications" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "vehicle_id" uuid,
        "type" "public"."certifications_type_enum" NOT NULL,
        "file_path" varchar(255) NOT NULL,
        "status" "public"."certifications_status_enum" NOT NULL DEFAULT 'pending_ocr',
        "ocr_extracted" jsonb,
        "rejection_reason" varchar(500),
        "expires_at" date,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "reviewed_at" timestamptz,
        "reviewed_by_user_id" uuid,
        CONSTRAINT "fk_certifications_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_certifications_vehicle"
          FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_certifications_reviewer"
          FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "chk_certifications_vehicle_for_insurance"
          CHECK (
            ("type" = 'insurance' AND "vehicle_id" IS NOT NULL)
            OR ("type" = 'license' AND "vehicle_id" IS NULL)
          )
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_certifications_user_type_status"
        ON "certifications" ("user_id", "type", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_certifications_vehicle_type"
        ON "certifications" ("vehicle_id", "type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_certifications_status_expires"
        ON "certifications" ("status", "expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_certifications_status_expires"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_certifications_vehicle_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_certifications_user_type_status"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "certifications"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."certifications_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."certifications_type_enum"`,
    );

    await queryRunner.query(`
      ALTER TABLE "vehicles"
        DROP COLUMN IF EXISTS "certified_until",
        DROP COLUMN IF EXISTS "is_certified"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "avatar_path",
        DROP COLUMN IF EXISTS "last_name",
        DROP COLUMN IF EXISTS "first_name"
    `);
  }
}
