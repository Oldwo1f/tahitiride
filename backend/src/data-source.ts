import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'kartiki',
  password: process.env.DATABASE_PASSWORD || 'kartiki',
  database: process.env.DATABASE_NAME || 'kartiki',
  entities: [__dirname + '/entities/*.entity.{ts,js}'],
  migrations: [__dirname + '/database/migrations/*.{ts,js}'],
  synchronize: false,
});
