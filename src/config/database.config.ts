import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { FiscalDocumentEntity } from '../domain/entities/fiscal-document.entity';

export function getTypeOrmConfig(configService: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: configService.getOrThrow<string>('DB_HOST'),
    port: Number(configService.get<string>('DB_PORT', '5432')),
    username: configService.getOrThrow<string>('DB_USER'),
    password: configService.getOrThrow<string>('DB_PASSWORD'),
    database: configService.getOrThrow<string>('DB_NAME'),
    entities: [FiscalDocumentEntity],
    synchronize: false,
    migrations: ['dist/migrations/*.js'],
    migrationsRun: true,
    logging: configService.get<string>('NODE_ENV') === 'local',
  };
}
