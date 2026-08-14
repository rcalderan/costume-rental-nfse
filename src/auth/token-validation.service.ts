import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

/**
 * Mirror simplificado do TokenValidationService do costume-rental-nfe (Java).
 * So valida, nunca emite token — o Rentafit e o emissor do JWT.
 */
@Injectable()
export class TokenValidationService {
  private readonly secret: string;
  private readonly issuer: string;

  constructor(configService: ConfigService) {
    this.secret = configService.getOrThrow<string>('RENTFIT_JWT_SECRET');
    this.issuer = configService.get<string>('RENTFIT_JWT_ISSUER', 'rentafit-api');
  }

  validate(token: string): string {
    try {
      const payload = jwt.verify(token, this.secret, {
        issuer: this.issuer,
        algorithms: ['HS256'],
      }) as jwt.JwtPayload;
      return payload.sub ?? '';
    } catch {
      throw new UnauthorizedException('Token JWT invalido ou expirado');
    }
  }
}
