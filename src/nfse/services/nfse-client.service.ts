import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'node:fs';
import type {
  EmitirParams,
  EmitirResult,
  IndicadorTotalTributos,
  TomadorInput,
  ValoresInput,
} from 'open-nfse';
import { EmitirNfseRequest } from '../dto/emitir-nfse.request';
import { EmitirNfseResponse } from '../dto/emitir-nfse.response';
import { PostgresDpsCounterService } from './postgres-dps-counter.service';
import { PostgresRetryStoreService } from './postgres-retry-store.service';
import {
  SharedFiscalIssuer,
  SharedFiscalIssuerService,
} from './shared-fiscal-issuer.service';

type Ambiente = 1 | 2;

const CERTIFICATE_ERRORS = new Set([
  'CertificateError',
  'ExpiredCertificateError',
  'InvalidCertificateError',
  'InvalidCertificatePasswordError',
]);
const FISCAL_VALIDATION_ERRORS = new Set([
  'ReceitaRejectionError',
  'RuleViolationError',
  'ValidationError',
  'XsdValidationError',
  'InvalidCpfError',
  'InvalidCnpjError',
]);
const TRANSIENT_ERRORS = new Set([
  'NetworkError',
  'ServerError',
  'TimeoutError',
  'TooManyRequestsError',
]);

interface NfseClientInstance {
  fetchByChave: (chave: string) => Promise<unknown>;
  emitir: (params: EmitirParams) => Promise<EmitirResult>;
  cancelar: (params: unknown) => Promise<unknown>;
  close: () => Promise<void>;
}

interface OpenNfseModule {
  NfseClient: new (config: unknown) => NfseClientInstance;
  Ambiente: { Producao: Ambiente; ProducaoRestrita: Ambiente };
}

/**
 * Wrapper da biblioteca open-nfse (ESM) carregada via dynamic import.
 * Isola a lib terceira da camada de controllers, seguindo o padrao
 * NfeLibraryAdapter do costume-rental-nfe (Java).
 *
 * A inicializacao do NfseClient eh lazy: a app sobe mesmo sem certificado
 * (util para health checks e ambientes locais). O certificado so eh lido
 * na primeira chamada que de fato precisa da lib.
 */
@Injectable()
export class NfseClientService {
  private readonly logger = new Logger(NfseClientService.name);
  private client: NfseClientInstance | null = null;
  private clientVersion: string | null = null;
  private initializing: Promise<NfseClientInstance> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly dpsCounter: PostgresDpsCounterService,
    private readonly retryStore: PostgresRetryStoreService,
    private readonly issuerService: SharedFiscalIssuerService,
  ) {}

  async consultarNfse(chaveAcesso: string): Promise<unknown> {
    const issuer = await this.issuerService.getActive();
    const client = await this.getClient(issuer);
    return client.fetchByChave(chaveAcesso);
  }

  async emitirNfse(request: EmitirNfseRequest): Promise<EmitirNfseResponse> {
    const tomador = this.toTomador(request);
    try {
      const issuer = await this.issuerService.getActive();
      this.assertServiceCode(request, issuer);
      this.assertServiceDescription(request, issuer);
      const client = await this.getClient(issuer);
      const result = await client.emitir(
        this.toEmitirParams(request, issuer, tomador),
      );
      return this.toEmitirResponse(result, request.vServ, issuer.series);
    } catch (error: unknown) {
      throw this.mapEmissionError(error);
    }
  }

  async cancelarNfse(params: unknown): Promise<unknown> {
    const issuer = await this.issuerService.getActive();
    const client = await this.getClient(issuer);
    return client.cancelar(params);
  }

  private assertServiceCode(
    request: EmitirNfseRequest,
    issuer: SharedFiscalIssuer,
  ): void {
    const code = request.cTribNac ?? issuer.serviceCode;
    if (!code || !/^\d{6}$/.test(code)) {
      throw new UnprocessableEntityException(
        `Código de Tributação Nacional ausente. Esperado: 6 dígitos em sistema/cnpj ou no payload. Recebido: '${code}'.`,
      );
    }
  }

  private assertServiceDescription(
    request: EmitirNfseRequest,
    issuer: SharedFiscalIssuer,
  ): void {
    const descricao = request.descricaoServico ?? issuer.serviceDescription;
    if (!descricao || !descricao.trim()) {
      throw new UnprocessableEntityException(
        'Descrição do serviço ausente. Esperado: descrição no payload ou padrão no emitente (sistema/cnpj).',
      );
    }
  }

  private toEmitirParams(
    request: EmitirNfseRequest,
    issuer: SharedFiscalIssuer,
    tomador: TomadorInput | undefined,
  ): EmitirParams {
    return {
      emitente: {
        cnpj: issuer.cnpj,
        codMunicipio: issuer.municipalityCode,
        // E0120: a IM do prestador só é enviada quando o emitente habilita o envio
        // (sistema/cnpj) — exige informações complementares do município no CNC NFS-e.
        ...(issuer.sendIm && issuer.municipalRegistration
          ? { inscricaoMunicipal: issuer.municipalRegistration }
          : {}),
        regime: {
          opSimpNac: issuer.simpleNationalOption,
          regApTribSN: issuer.simpleNationalAssessmentRegime,
          regEspTrib: issuer.specialTaxRegime,
        },
      },
      serie: issuer.series,
      servico: {
        cTribNac: request.cTribNac ?? issuer.serviceCode,
        cNBS: request.cNBS ?? issuer.nbsCode,
        descricao: (request.descricaoServico ?? issuer.serviceDescription)!,
        codMunicipioPrestacao:
          request.codigoMunicipioPrestacao ?? issuer.municipalityCode,
      },
      valores: this.toValores(request, issuer),
      tomador,
    };
  }

  private toValores(
    request: EmitirNfseRequest,
    issuer: SharedFiscalIssuer,
  ): ValoresInput {
    const valores: ValoresInput = {
      vServ: request.vServ,
      aliqIss: request.aliqIss ?? issuer.issRate,
    };
    if (issuer.simpleNationalOption === '2') {
      return { ...valores, indTotTrib: '0' as IndicadorTotalTributos };
    }
    if (issuer.simpleNationalOption === '3') {
      return {
        ...valores,
        pTotTribSN: request.pTotTribSN ?? issuer.totalTaxRate ?? 0,
      };
    }
    const federal = request.pTotTribFed;
    const state = request.pTotTribEst;
    const municipal = request.pTotTribMun;
    if (federal == null || state == null || municipal == null) {
      throw new BadRequestException(
        'Tributos aproximados ausentes para emitente não optante. Esperado: pTotTribFed, pTotTribEst e pTotTribMun.',
      );
    }
    return {
      ...valores,
      pTotTrib: {
        pTotTribFed: federal,
        pTotTribEst: state,
        pTotTribMun: municipal,
      },
    };
  }

  private toTomador(request: EmitirNfseRequest): TomadorInput | undefined {
    if (!request.docTomador && !request.nomeTomador) {
      return undefined;
    }
    const documento = request.docTomador?.replace(/\D/g, '') ?? '';
    if (!request.nomeTomador || ![11, 14].includes(documento.length)) {
      throw new BadRequestException(
        `Tomador inválido: documento '${request.docTomador ?? ''}' deve ter 11 ou 14 dígitos e nome é obrigatório`,
      );
    }
    return {
      documento:
        documento.length === 11 ? { CPF: documento } : { CNPJ: documento },
      nome: request.nomeTomador,
      email: request.emailTomador,
    };
  }

  private toEmitirResponse(
    result: EmitirResult,
    serviceValue: number,
    series: string,
  ): EmitirNfseResponse {
    if (result.status === 'retry_pending') {
      return {
        status: 'PENDING',
        series,
        protocol: result.pending.idDps,
        processingDate: result.pending.lastAttemptAt,
        serviceValue,
      };
    }
    const info = result.nfse.nfse.infNFSe;
    return {
      status: 'AUTHORIZED',
      accessKey: result.nfse.chaveAcesso,
      invoiceNumber: Number(info.nNFSe),
      series,
      protocol: result.nfse.idDps,
      issueDate: info.DPS.infDPS.dhEmi,
      processingDate: result.nfse.dataHoraProcessamento,
      serviceValue,
      authorizedXml: result.nfse.xmlNfse,
    };
  }

  private mapEmissionError(error: unknown): HttpException {
    this.logEmissionError(error);
    if (error instanceof HttpException) return error;
    const name = error instanceof Error ? error.name : 'UnknownError';
    const message = error instanceof Error ? error.message : String(error);
    if (CERTIFICATE_ERRORS.has(name)) {
      return new ServiceUnavailableException(
        `Certificado fiscal indisponível: ${message}`,
      );
    }
    if (FISCAL_VALIDATION_ERRORS.has(name)) {
      return new UnprocessableEntityException(message);
    }
    if (TRANSIENT_ERRORS.has(name)) {
      return new ServiceUnavailableException(
        `Portal Nacional NFS-e indisponível: ${message}`,
      );
    }
    return new InternalServerErrorException(
      'Falha interna ao preparar a emissão da NFS-e. Consulte os logs do serviço.',
    );
  }

  private logEmissionError(error: unknown): void {
    const name = error instanceof Error ? error.name : 'UnknownError';
    const message = error instanceof Error ? error.message : String(error);
    const trace = error instanceof Error ? error.stack : undefined;
    this.logger.error(`Falha na emissão NFS-e [${name}]: ${message}`, trace);
  }

  private async getClient(
    issuer: SharedFiscalIssuer,
  ): Promise<NfseClientInstance> {
    if (this.client && this.clientVersion === issuer.version)
      return this.client;
    if (this.initializing) return this.initializing;
    if (this.client) await this.client.close();
    this.initializing = this.initializeClient(issuer);
    try {
      this.client = await this.initializing;
      this.clientVersion = issuer.version;
      return this.client;
    } finally {
      this.initializing = null;
    }
  }

  private async initializeClient(
    issuer: SharedFiscalIssuer,
  ): Promise<NfseClientInstance> {
    const ambienteStr = this.configService.get<string>('NFSE_AMBIENTE', '2');
    const ambiente: Ambiente = ambienteStr === '1' ? 1 : 2;
    if (!existsSync(issuer.certificatePath)) {
      throw new ServiceUnavailableException(
        `Certificado não encontrado em '${issuer.certificatePath}'. Esperado: arquivo .pfx compartilhado com o serviço de NF-e.`,
      );
    }

    const openNfse = (await import('open-nfse')) as unknown as OpenNfseModule;
    const pfx = readFileSync(issuer.certificatePath);
    const client = new openNfse.NfseClient({
      ambiente:
        ambiente === 1
          ? openNfse.Ambiente.Producao
          : openNfse.Ambiente.ProducaoRestrita,
      certificado: { pfx, password: issuer.certificatePassword },
      dpsCounter: this.dpsCounter,
      retryStore: this.retryStore,
    });

    this.logger.log(
      `NfseClient inicializado para cnpj=${issuer.cnpj} (ambiente=${ambiente === 1 ? 'producao' : 'homologacao'})`,
    );
    return client;
  }
}
