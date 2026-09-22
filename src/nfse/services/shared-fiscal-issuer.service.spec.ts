import { ConfigService } from '@nestjs/config';
import { createCipheriv } from 'node:crypto';
import { DataSource } from 'typeorm';
import { SharedFiscalIssuerService } from './shared-fiscal-issuer.service';

class FakeIssuerDataSource {
  readonly query = jest.fn();
}

class FakeEncryptionConfig {
  constructor(private readonly encodedKey: string) {}

  get<T>(key: string): T | undefined {
    return key === 'CERT_ENCRYPTION_KEY' ? (this.encodedKey as T) : undefined;
  }
}

function encryptLikeJava(plaintext: string, key: Buffer): string {
  const iv = Buffer.alloc(12, 7);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString('base64');
}

describe('SharedFiscalIssuerService', () => {
  it('lê o emitente ativo e decifra a senha gravada pelo serviço de NF-e', async () => {
    const key = Buffer.alloc(32, 3);
    const dataSource = new FakeIssuerDataSource();
    dataSource.query.mockResolvedValue([
      {
        id: 'issuer-1',
        cnpj: '08299621000120',
        crt: '1',
        municipalRegistration: '51197',
        municipalityCode: '3548906',
        certificatePath: '/certs/company.pfx',
        encryptedPassword: encryptLikeJava('certificate-password', key),
        nfseServiceCode: '010101',
        nfseNbsCode: '10101',
        nfseServiceDescription: 'Locação de trajes',
        nfseIssRate: '2.50',
        nfseTotalTaxRate: '6.00',
        nfseSendIm: true,
        updatedAt: '2026-09-15T10:00:00Z',
      },
    ]);
    const service = new SharedFiscalIssuerService(
      dataSource as unknown as DataSource,
      new FakeEncryptionConfig(
        key.toString('base64'),
      ) as unknown as ConfigService,
    );

    const issuer = await service.getActive();

    expect(issuer).toMatchObject({
      cnpj: '08299621000120',
      municipalRegistration: '51197',
      municipalityCode: '3548906',
      certificatePath: '/certs/company.pfx',
      certificatePassword: 'certificate-password',
      series: '1',
      simpleNationalOption: '3',
      simpleNationalAssessmentRegime: '1',
      specialTaxRegime: '0',
      serviceCode: '010101',
      nbsCode: '10101',
      serviceDescription: 'Locação de trajes',
      issRate: 2.5,
      totalTaxRate: 6,
      sendIm: true,
    });
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM nfe_issuer'),
    );
  });

  it('retorna 503 quando não existe emitente ativo com certificado', async () => {
    const dataSource = new FakeIssuerDataSource();
    dataSource.query.mockResolvedValue([]);
    const service = new SharedFiscalIssuerService(
      dataSource as unknown as DataSource,
      new FakeEncryptionConfig(
        Buffer.alloc(32).toString('base64'),
      ) as unknown as ConfigService,
    );

    await expect(service.getActive()).rejects.toMatchObject({ status: 503 });
  });
});
