import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDestination1713200000000 implements MigrationInterface {
  name = 'AddDestination1713200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "driver_status" ADD COLUMN IF NOT EXISTS "destination" varchar(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "passenger_waits" ADD COLUMN IF NOT EXISTS "destination" varchar(64)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "passenger_waits" DROP COLUMN IF EXISTS "destination"`,
    );
    await queryRunner.query(
      `ALTER TABLE "driver_status" DROP COLUMN IF EXISTS "destination"`,
    );
  }
}
