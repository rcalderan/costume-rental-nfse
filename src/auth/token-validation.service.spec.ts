import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TokenValidationService } from './token-validation.service';
import * as jwt from 'jsonwebtoken';

describe('TokenValidationService', () => {
  let service: TokenValidationService;
  const secret = 'local-dev-secret-change-in-prod-must-be-at-least-32-chars';
  const issuer = 'rentafit-api';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TokenValidationService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'RENTFIT_JWT_SECRET') return secret;
              throw new Error(`Missing ${key}`);
            },
            get: (key: string, fallback?: string) => {
              if (key === 'RENTFIT_JWT_ISSUER') return issuer;
              return fallback;
            },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(TokenValidationService);
  });

  it('valida um token valido e retorna o subject', () => {
    const token = jwt.sign({ sub: 'user-123' }, secret, {
      issuer,
      algorithm: 'HS256',
    });
    expect(service.validate(token)).toBe('user-123');
  });

  it('rejeita token com secret errado', () => {
    const token = jwt.sign({ sub: 'user-123' }, 'wrong-secret', {
      issuer,
      algorithm: 'HS256',
    });
    expect(() => service.validate(token)).toThrow();
  });

  it('rejeita token com issuer errado', () => {
    const token = jwt.sign({ sub: 'user-123' }, secret, {
      issuer: 'wrong-issuer',
      algorithm: 'HS256',
    });
    expect(() => service.validate(token)).toThrow();
  });
});
