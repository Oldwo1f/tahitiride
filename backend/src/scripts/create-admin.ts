import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BootstrapAdminService } from '../modules/admin/services/bootstrap-admin.service';

interface CliArgs {
  email?: string;
  password?: string;
  name?: string;
  help?: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '-h' || token === '--help') {
      args.help = true;
      continue;
    }
    const eq = token.indexOf('=');
    let key: string;
    let value: string | undefined;
    if (token.startsWith('--') && eq > 0) {
      key = token.slice(2, eq);
      value = token.slice(eq + 1);
    } else if (token.startsWith('--')) {
      key = token.slice(2);
      value = argv[++i];
    } else {
      continue;
    }
    if (key === 'email') args.email = value;
    else if (key === 'password') args.password = value;
    else if (key === 'name') args.name = value;
  }
  return args;
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`Usage:
  pnpm run admin:create -- --email=<email> --password=<password> [--name="<full name>"]

Promotes the user with the given email to role=admin (idempotent), or
creates a fresh admin account if no such user exists. Reads database
credentials from the same .env as the API.`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.email) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }
  const logger = new Logger('CreateAdmin');

  // Disable the auto-bootstrap branch of BootstrapAdminService so the CLI
  // path is the single source of truth for this run.
  delete process.env.BOOTSTRAP_ADMIN_EMAIL;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const bootstrap = app.get(BootstrapAdminService);
    const result = await bootstrap.upsert({
      email: args.email,
      password: args.password,
      fullName: args.name,
    });
    const verb = result.created
      ? 'created'
      : result.promoted
        ? 'promoted'
        : 'left untouched';
    logger.log(
      `Admin "${result.user.email}" ${verb}.` +
        (result.passwordReset ? ' Password updated.' : ''),
    );
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(
    'create-admin failed:',
    err instanceof Error ? err.stack || err.message : err,
  );
  process.exit(1);
});
