import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the manual top-up & payout flow:
 *
 *   - `wallet_requests` table: one row per user-initiated funds request.
 *     `type='deposit'` means the user claims they made a bank transfer to
 *     the platform; `type='payout'` means a driver asks the platform to
 *     wire their wallet balance to their IBAN. Status moves through
 *     `pending` → (`approved` | `rejected` | `cancelled`) and stays
 *     immutable afterwards (idempotency is enforced in code via a
 *     pessimistic lock + status check).
 *
 *   - `wallet_transactions.wallet_request_id` column: links a
 *     credit/debit transaction to the request that triggered it, so the
 *     full money trail (admin clicked "approve" → wallet moved → audit
 *     row) can be reconciled in one query.
 */
export class WalletRequests1713600000000 implements MigrationInterface {
  name = 'WalletRequests1713600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'wallet_request_type_enum'
        ) THEN
          CREATE TYPE "public"."wallet_request_type_enum"
            AS ENUM ('deposit','payout');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'wallet_request_status_enum'
        ) THEN
          CREATE TYPE "public"."wallet_request_status_enum"
            AS ENUM ('pending','approved','rejected','cancelled');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wallet_requests" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" "public"."wallet_request_type_enum" NOT NULL,
        "status" "public"."wallet_request_status_enum" NOT NULL DEFAULT 'pending',
        "amount_xpf" integer NOT NULL,
        "iban" varchar(34),
        "account_holder_name" varchar(120),
        "user_note" text,
        "admin_note" text,
        "processed_by_user_id" uuid,
        "processed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_wallet_requests_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_wallet_requests_processed_by"
          FOREIGN KEY ("processed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "chk_wallet_requests_amount_positive"
          CHECK ("amount_xpf" > 0),
        CONSTRAINT "chk_wallet_requests_payout_iban"
          CHECK (
            ("type" = 'payout' AND "iban" IS NOT NULL AND "account_holder_name" IS NOT NULL)
            OR ("type" = 'deposit')
          )
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_wallet_requests_user_created"
        ON "wallet_requests" ("user_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_wallet_requests_status_type_created"
        ON "wallet_requests" ("status", "type", "created_at" DESC)`,
    );

    await queryRunner.query(`
      ALTER TABLE "wallet_transactions"
        ADD COLUMN IF NOT EXISTS "wallet_request_id" uuid
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_schema = 'public'
            AND table_name = 'wallet_transactions'
            AND constraint_name = 'fk_wallet_tx_request'
        ) THEN
          ALTER TABLE "wallet_transactions"
            ADD CONSTRAINT "fk_wallet_tx_request"
            FOREIGN KEY ("wallet_request_id") REFERENCES "wallet_requests"("id") ON DELETE SET NULL;
        END IF;
      END$$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_wallet_tx_request_id"
        ON "wallet_transactions" ("wallet_request_id")
        WHERE "wallet_request_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_wallet_tx_request_id"`);
    await queryRunner.query(
      `ALTER TABLE "wallet_transactions" DROP CONSTRAINT IF EXISTS "fk_wallet_tx_request"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_transactions" DROP COLUMN IF EXISTS "wallet_request_id"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_wallet_requests_status_type_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_wallet_requests_user_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_requests"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."wallet_request_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."wallet_request_type_enum"`,
    );
  }
}
