import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenValidationService } from './token-validation.service';

@Module({
  providers: [
    TokenValidationService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [TokenValidationService],
})
export class AuthModule {}
