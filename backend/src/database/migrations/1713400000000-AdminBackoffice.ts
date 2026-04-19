import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin back-office: adds the `admin` role to users, soft-delete + suspend
 * columns on `users`, an `adjustment` value to wallet transactions plus the
 * audit columns to trace manual changes, and creates the two new tables
 * `app_settings` (runtime overlay over `app.config.ts`) and `admin_actions`
 * (immutable audit log).
 */
export class AdminBackoffice1713400000000 implements MigrationInterface {
  name = 'AdminBackoffice1713400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ALTER TYPE … ADD VALUE is non-transactional in older Postgres versions;
    // it does run inside a TX from PG12+, but we still guard with a SELECT
    // so the migration is idempotent if re-applied.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'users_role_enum' AND e.enumlabel = 'admin'
        ) THEN
          ALTER TYPE "public"."users_role_enum" ADD VALUE 'admin';
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'wallet_tx_type_enum' AND e.enumlabel = 'adjustment'
        ) THEN
          ALTER TYPE "public"."wallet_tx_type_enum" ADD VALUE 'adjustment';
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "suspended_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_users_alive" ON "users" ("id") WHERE "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      ALTER TABLE "wallet_transactions"
        ADD COLUMN IF NOT EXISTS "reason" text,
        ADD COLUMN IF NOT EXISTS "actor_user_id" uuid
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_schema = 'public'
            AND table_name = 'wallet_transactions'
            AND constraint_name = 'fk_wallet_tx_actor'
        ) THEN
          ALTER TABLE "wallet_transactions"
            ADD CONSTRAINT "fk_wallet_tx_actor"
            FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_settings" (
        "key" varchar(64) PRIMARY KEY,
        "value" jsonb NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "updated_by_user_id" uuid,
        CONSTRAINT "fk_app_settings_user" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_actions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "actor_user_id" uuid NOT NULL,
        "action" varchar(64) NOT NULL,
        "target_type" varchar(32) NOT NULL,
        "target_id" uuid,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_admin_actions_actor" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_admin_actions_actor_time" ON "admin_actions" ("actor_user_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_admin_actions_action_time" ON "admin_actions" ("action", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drops in reverse order. We do NOT remove the 'admin' / 'adjustment'
    // enum values: Postgres has no first-class way to drop a single enum
    // value safely, and leaving them around is harmless.
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_actions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "app_settings"`);

    await queryRunner.query(`
      ALTER TABLE "wallet_transactions"
        DROP CONSTRAINT IF EXISTS "fk_wallet_tx_actor"
    `);
    await queryRunner.query(`
      ALTER TABLE "wallet_transactions"
        DROP COLUMN IF EXISTS "actor_user_id",
        DROP COLUMN IF EXISTS "reason"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_alive"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "deleted_at",
        DROP COLUMN IF EXISTS "suspended_at"
    `);
  }
}
