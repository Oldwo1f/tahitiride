import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';

interface CliArgs {
  confirm?: boolean;
  help?: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (const token of argv) {
    if (token === '-h' || token === '--help') {
      args.help = true;
    } else if (token === '--confirm' || token === '-y') {
      args.confirm = true;
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`Usage:
  pnpm run clean:test-data -- [--confirm]

Test-only utility to wipe driver/vehicle related state and reset every
non-admin user's driver-mode flag. Useful to start fresh on the new
driver onboarding wizard during the test phase.

Operations performed (inside a transaction):
  - TRUNCATE trip_points, trips, certifications, vehicles RESTART IDENTITY CASCADE
  - UPDATE users SET is_driver = FALSE WHERE is_driver = TRUE

Without --confirm the script only prints what would be deleted. Pass
--confirm (or -y) to actually run the cleanup.

In Docker:
  docker compose exec backend node dist/scripts/clean-test-data.js --confirm
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const logger = new Logger('CleanTestData');

  // Skip the bootstrap admin promotion path so it can't race with our
  // flag reset during this run.
  delete process.env.BOOTSTRAP_ADMIN_EMAIL;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const dataSource = app.get(DataSource);

    const counts = await dataSource.transaction(async (tx) => {
      const [{ count: vehicles }] = await tx.query<{ count: string }[]>(
        `SELECT COUNT(*) FROM vehicles`,
      );
      const [{ count: certs }] = await tx.query<{ count: string }[]>(
        `SELECT COUNT(*) FROM certifications`,
      );
      const [{ count: trips }] = await tx.query<{ count: string }[]>(
        `SELECT COUNT(*) FROM trips`,
      );
      const [{ count: points }] = await tx.query<{ count: string }[]>(
        `SELECT COUNT(*) FROM trip_points`,
      );
      const [{ count: drivers }] = await tx.query<{ count: string }[]>(
        `SELECT COUNT(*) FROM users WHERE is_driver = TRUE`,
      );
      return {
        vehicles: Number(vehicles),
        certs: Number(certs),
        trips: Number(trips),
        points: Number(points),
        drivers: Number(drivers),
      };
    });

    logger.log(`Current state:`);
    logger.log(`  vehicles:       ${counts.vehicles}`);
    logger.log(`  certifications: ${counts.certs}`);
    logger.log(`  trips:          ${counts.trips}`);
    logger.log(`  trip_points:    ${counts.points}`);
    logger.log(`  users with driver mode on: ${counts.drivers}`);

    if (!args.confirm) {
      logger.warn(`Dry run — pass --confirm to actually wipe the data above.`);
      return;
    }

    await dataSource.transaction(async (tx) => {
      await tx.query(
        `TRUNCATE TABLE "trip_points","trips","certifications","vehicles" RESTART IDENTITY CASCADE`,
      );
      await tx.query(
        `UPDATE "users" SET is_driver = FALSE WHERE is_driver = TRUE`,
      );
    });

    logger.log(
      `Cleanup done: vehicles, trips, trip_points and certifications wiped; ${counts.drivers} user(s) reset to passenger-only mode.`,
    );
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error(
    'clean-test-data failed:',
    err instanceof Error ? err.stack || err.message : err,
  );
  process.exit(1);
});
