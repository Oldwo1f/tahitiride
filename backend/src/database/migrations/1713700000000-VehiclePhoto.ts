import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `vehicles.photo_path` column. It stores the relative path under
 * the upload root (e.g. `vehicles/<uuid>.jpg`) of the 3/4 face photo taken
 * during the driver onboarding wizard. Nullable so existing rows (and any
 * legacy creation paths) keep working — new vehicles always go through the
 * wizard which captures a photo.
 */
export class VehiclePhoto1713700000000 implements MigrationInterface {
  name = 'VehiclePhoto1713700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "photo_path" varchar(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "photo_path"`,
    );
  }
}
