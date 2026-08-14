import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getTypeOrmConfig } from './config/database.config';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { NfseModule } from './nfse/nfse.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'docker' ? undefined : '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getTypeOrmConfig,
    }),
    HealthModule,
    AuthModule,
    NfseModule,
  ],
})
export class AppModule {}
