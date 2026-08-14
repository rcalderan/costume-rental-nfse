import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? '5432'),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '1234567',
  database: process.env.DB_NAME ?? 'costume_rental_nfse',
  entities: ['src/domain/entities/*.ts'],
  migrations: ['src/migrations/*.ts'],
});
