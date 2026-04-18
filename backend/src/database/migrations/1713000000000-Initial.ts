import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1713000000000 implements MigrationInterface {
  name = 'Initial1713000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('passenger','driver','both')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."direction_enum" AS ENUM('city','country')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."trip_status_enum" AS ENUM('active','completed','cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."wallet_tx_type_enum" AS ENUM('initial','debit','credit')`,
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar(255) NOT NULL UNIQUE,
        "phone" varchar(32),
        "password_hash" varchar(255) NOT NULL,
        "full_name" varchar(120) NOT NULL,
        "role" "public"."users_role_enum" NOT NULL DEFAULT 'both',
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "vehicles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "plate" varchar(16) NOT NULL,
        "model" varchar(80) NOT NULL,
        "color" varchar(40) NOT NULL,
        "qr_secret" varchar(128) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_vehicles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_vehicles_user_id" ON "vehicles" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "driver_status" (
        "user_id" uuid PRIMARY KEY,
        "vehicle_id" uuid,
        "is_online" boolean NOT NULL DEFAULT false,
        "direction" "public"."direction_enum",
        "current_position" geography(Point,4326),
        "heading" double precision,
        "speed" double precision,
        "last_seen_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_driver_status_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_driver_status_vehicle" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_driver_status_online" ON "driver_status" ("is_online")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_driver_status_position" ON "driver_status" USING GIST ("current_position")`,
    );

    await queryRunner.query(`
      CREATE TABLE "passenger_waits" (
        "user_id" uuid PRIMARY KEY,
        "is_waiting" boolean NOT NULL DEFAULT false,
        "direction" "public"."direction_enum",
        "position" geography(Point,4326),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_passenger_waits_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_passenger_waits_waiting" ON "passenger_waits" ("is_waiting")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_passenger_waits_position" ON "passenger_waits" USING GIST ("position")`,
    );

    await queryRunner.query(`
      CREATE TABLE "trips" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "passenger_id" uuid NOT NULL,
        "driver_id" uuid NOT NULL,
        "vehicle_id" uuid NOT NULL,
        "status" "public"."trip_status_enum" NOT NULL DEFAULT 'active',
        "started_at" timestamptz NOT NULL DEFAULT now(),
        "ended_at" timestamptz,
        "start_point" geography(Point,4326),
        "end_point" geography(Point,4326),
        "distance_m" double precision,
        "fare_xpf" integer,
        "pickup_token_jti" varchar(128) NOT NULL,
        "dropoff_token_jti" varchar(128),
        CONSTRAINT "fk_trips_passenger" FOREIGN KEY ("passenger_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_trips_driver" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_trips_vehicle" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_trips_passenger_id" ON "trips" ("passenger_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_trips_driver_id" ON "trips" ("driver_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_trips_status" ON "trips" ("status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_trips_pickup_jti" ON "trips" ("pickup_token_jti")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_trips_dropoff_jti" ON "trips" ("dropoff_token_jti") WHERE "dropoff_token_jti" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "trip_points" (
        "id" bigserial PRIMARY KEY,
        "trip_id" uuid NOT NULL,
        "seq" integer NOT NULL,
        "position" geography(Point,4326) NOT NULL,
        "recorded_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_trip_points_trip" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_trip_points_trip_seq" ON "trip_points" ("trip_id","seq")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_trip_points_position" ON "trip_points" USING GIST ("position")`,
    );

    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "user_id" uuid PRIMARY KEY,
        "balance_xpf" integer NOT NULL DEFAULT 0,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_wallets_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "wallet_transactions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "amount_xpf" integer NOT NULL,
        "type" "public"."wallet_tx_type_enum" NOT NULL,
        "trip_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_wallet_tx_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_wallet_tx_trip" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_wallet_tx_user_id" ON "wallet_transactions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_wallet_tx_trip_id" ON "wallet_transactions" ("trip_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_wallet_tx_trip_type_user" ON "wallet_transactions" ("trip_id","type","user_id") WHERE "trip_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wallets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trip_points"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trips"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "passenger_waits"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "driver_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vehicles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."wallet_tx_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."trip_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."direction_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_role_enum"`);
  }
}
