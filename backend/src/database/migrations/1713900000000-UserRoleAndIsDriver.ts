import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Splits the legacy `UserRole` (`passenger | driver | both | admin`) into:
 *   - `role`: access control only — `user | admin`
 *   - `is_driver`: independent mode flag any user can toggle from their
 *     profile (passenger is the default, `is_driver = true` unlocks the
 *     driver-only UI/endpoints).
 *
 * Data mapping:
 *   - `passenger` -> role='user', is_driver=false
 *   - `driver`    -> role='user', is_driver=true
 *   - `both`      -> role='user', is_driver=true  (preserve active driver
 *                     capability; the user can flip back to passenger-only
 *                     from the profile switch.)
 *   - `admin`     -> role='admin', is_driver=false (pure admin role by
 *                     default; admin can still toggle driver mode on to
 *                     add a vehicle.)
 *
 * Postgres doesn't expose a safe way to remove values from an enum, so we
 * swap the `users.role` column to a fresh `users_role_enum_v2` type then
 * drop the old one.
 */
export class UserRoleAndIsDriver1713900000000 implements MigrationInterface {
  name = 'UserRoleAndIsDriver1713900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "is_driver" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      UPDATE "users"
         SET "is_driver" = TRUE
       WHERE "role"::text IN ('driver', 'both')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."users_role_enum_v2" AS ENUM('user', 'admin')
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "role" DROP DEFAULT
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "role" TYPE "public"."users_role_enum_v2"
        USING (
          CASE
            WHEN "role"::text = 'admin' THEN 'admin'::"public"."users_role_enum_v2"
            ELSE 'user'::"public"."users_role_enum_v2"
          END
        )
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "role" SET DEFAULT 'user'
    `);

    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`
      ALTER TYPE "public"."users_role_enum_v2"
        RENAME TO "users_role_enum"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."users_role_enum_legacy" AS ENUM(
        'passenger', 'driver', 'both', 'admin'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "role" DROP DEFAULT
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "role" TYPE "public"."users_role_enum_legacy"
        USING (
          CASE
            WHEN "role"::text = 'admin' THEN 'admin'::"public"."users_role_enum_legacy"
            WHEN "is_driver" = TRUE THEN 'both'::"public"."users_role_enum_legacy"
            ELSE 'passenger'::"public"."users_role_enum_legacy"
          END
        )
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "role" SET DEFAULT 'both'
    `);

    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`
      ALTER TYPE "public"."users_role_enum_legacy"
        RENAME TO "users_role_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "is_driver"
    `);
  }
}
