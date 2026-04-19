import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDriverShare1713300000000 implements MigrationInterface {
  name = 'AddDriverShare1713300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Amount actually credited to the driver for this trip. The platform
    // keeps the difference between `fare_xpf` (what the passenger paid) and
    // `driver_share_xpf` (what the driver received) as its margin (the
    // base/booking fee). Nullable for historical rows that predate the split.
    await queryRunner.query(
      `ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "driver_share_xpf" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trips" DROP COLUMN IF EXISTS "driver_share_xpf"`,
    );
  }
}
