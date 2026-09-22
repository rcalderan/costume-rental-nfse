import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { createDecipheriv } from 'node:crypto';
import { DataSource } from 'typeorm';
import type {
  OpcaoSimplesNacional,
  RegimeApuracaoSimplesNacional,
  RegimeEspecialTributacao,
} from 'open-nfse';

interface SharedFiscalIssuerRow {
  id: string;
  cnpj: string;
  crt: string;
  municipalRegistration: string | null;
  municipalityCode: string;
  certificatePath: string;
  encryptedPassword: string;
  nfseServiceCode: string | null;
  nfseNbsCode: string | null;
  nfseServiceDescription: string | null;
  nfseIssRate: string | null;
  nfseTotalTaxRate: string | null;
  nfseSendIm: boolean | null;
  updatedAt: Date | string;
}

export interface SharedFiscalIssuer {
  version: string;
  cnpj: string;
  municipalRegistration?: string;
  municipalityCode: string;
  certificatePath: string;
  certificatePassword: string;
  series: string;
  simpleNationalOption: OpcaoSimplesNacional;
  simpleNationalAssessmentRegime?: RegimeApuracaoSimplesNacional;
  specialTaxRegime: RegimeEspecialTributacao;
  serviceCode: string;
  nbsCode?: string;
  serviceDescription?: string;
  issRate?: number;
  totalTaxRate?: number;
  /** true = envia a IM do prestador na DPS (exige cadastro complementar no CNC NFS-e). */
  sendIm: boolean;
}

@Injectable()
export class SharedFiscalIssuerService {
  constructor(
    @InjectDataSource('nfe-config') private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async getActive(): Promise<SharedFiscalIssuer> {
    const rows = await this.dataSource.query<SharedFiscalIssuerRow[]>(`
      SELECT i.id::text,
             f.root_cnpj || f.branch_order || f.digit AS cnpj,
             f.crt,
             i.im AS "municipalRegistration",
             i.municipio_codigo AS "municipalityCode",
             i.certificate_path AS "certificatePath",
             i.encrypted_password AS "encryptedPassword",
             i.nfse_service_code AS "nfseServiceCode",
             i.nfse_nbs_code AS "nfseNbsCode",
             i.nfse_service_description AS "nfseServiceDescription",
             i.nfse_iss_rate::text AS "nfseIssRate",
             i.nfse_total_tax_rate::text AS "nfseTotalTaxRate",
             i.nfse_send_im AS "nfseSendIm",
             i.updated_at AS "updatedAt"
        FROM nfe_issuer i
        JOIN firm f ON f.id = i.firm_id
       WHERE i.active = true
         AND i.certificate_path IS NOT NULL
         AND i.encrypted_password IS NOT NULL
       ORDER BY f.branch_order
       LIMIT 1
    `);
    const row = rows[0];
    if (!row) {
      throw new ServiceUnavailableException(
        'Emitente fiscal ativo sem certificado. Esperado: certificado A1 configurado no serviço de NF-e.',
      );
    }
    return this.toIssuer(row);
  }

  private toIssuer(row: SharedFiscalIssuerRow): SharedFiscalIssuer {
    const simpleNationalOption = this.mapSimpleNationalOption(row.crt);
    return {
      version: `${row.id}:${new Date(row.updatedAt).toISOString()}`,
      cnpj: row.cnpj,
      municipalRegistration: row.municipalRegistration ?? undefined,
      municipalityCode: row.municipalityCode,
      certificatePath: row.certificatePath,
      certificatePassword: this.decryptPassword(row.encryptedPassword),
      series: this.configService.get<string>('NFSE_SERIE', '1') ?? '1',
      simpleNationalOption,
      simpleNationalAssessmentRegime:
        simpleNationalOption === ('3' as OpcaoSimplesNacional)
          ? ('1' as RegimeApuracaoSimplesNacional)
          : undefined,
      specialTaxRegime: '0' as RegimeEspecialTributacao,
      serviceCode: row.nfseServiceCode ?? '',
      nbsCode: row.nfseNbsCode ?? undefined,
      serviceDescription: row.nfseServiceDescription ?? undefined,
      issRate: row.nfseIssRate != null ? Number(row.nfseIssRate) : undefined,
      totalTaxRate:
        row.nfseTotalTaxRate != null ? Number(row.nfseTotalTaxRate) : undefined,
      sendIm: row.nfseSendIm === true,
    };
  }

  private mapSimpleNationalOption(crt: string): OpcaoSimplesNacional {
    if (crt === '4') return '2' as OpcaoSimplesNacional;
    if (crt === '1' || crt === '2') return '3' as OpcaoSimplesNacional;
    if (crt === '3') return '1' as OpcaoSimplesNacional;
    throw new ServiceUnavailableException(
      `CRT do emitente inválido: '${crt}'. Esperado: 1, 2, 3 ou 4.`,
    );
  }

  private decryptPassword(encryptedPassword: string): string {
    try {
      const key = this.readEncryptionKey();
      const payload = Buffer.from(encryptedPassword, 'base64');
      const iv = payload.subarray(0, 12);
      const authTag = payload.subarray(payload.length - 16);
      const cipherText = payload.subarray(12, payload.length - 16);
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([
        decipher.update(cipherText),
        decipher.final(),
      ]).toString('utf8');
    } catch (error: unknown) {
      throw new ServiceUnavailableException(
        `Senha do certificado não pôde ser decifrada com CERT_ENCRYPTION_KEY: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private readEncryptionKey(): Buffer {
    const encodedKey = this.configService.get<string>('CERT_ENCRYPTION_KEY');
    const key = Buffer.from(encodedKey ?? '', 'base64');
    if (key.length !== 32) {
      throw new Error(
        `CERT_ENCRYPTION_KEY possui ${key.length} bytes. Esperado: 32 bytes em base64.`,
      );
    }
    return key;
  }
}
