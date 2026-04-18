import { registerAs } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USER || 'tahiti',
    password: process.env.DATABASE_PASSWORD || 'tahiti',
    database: process.env.DATABASE_NAME || 'tahiti_ride',
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: true,
    logging:
      process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    migrations: [__dirname + '/../database/migrations/*.{ts,js}'],
  }),
);
