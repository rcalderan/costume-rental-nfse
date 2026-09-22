import { ConfigService } from '@nestjs/config';
import type { EmitirParams, EmitirResult } from 'open-nfse';
import { EmitirNfseRequest } from '../dto/emitir-nfse.request';
import { NfseClientService } from './nfse-client.service';
import { PostgresDpsCounterService } from './postgres-dps-counter.service';
import { PostgresRetryStoreService } from './postgres-retry-store.service';
import {
  SharedFiscalIssuer,
  SharedFiscalIssuerService,
} from './shared-fiscal-issuer.service';

const sharedIssuer = {
  version: 'issuer-1:2026-09-15T10:00:00.000Z',
  cnpj: '08299621000120',
  municipalRegistration: '51197',
  municipalityCode: '3548906',
  certificatePath: '/certs/missing.pfx',
  certificatePassword: 'secret',
  series: '1',
  simpleNationalOption: '3',
  simpleNationalAssessmentRegime: '1',
  specialTaxRegime: '0',
  serviceCode: '010101',
  nbsCode: '10101',
  serviceDescription: 'Locação de trajes',
  issRate: 2.5,
  totalTaxRate: 6,
  sendIm: false,
} as SharedFiscalIssuer;

class EmptyNfseConfig {
  get<T>(_key: string, fallback?: T): T | undefined {
    return fallback;
  }
}

class FakeSharedFiscalIssuerService {
  constructor(
    private readonly issuer: SharedFiscalIssuer = sharedIssuer,
  ) {}

  async getActive(): Promise<SharedFiscalIssuer> {
    return this.issuer;
  }
}

class FakeNfseClient {
  emitted?: EmitirParams;

  constructor(private readonly result: EmitirResult | Error) {}

  async emitir(params: EmitirParams): Promise<EmitirResult> {
    this.emitted = params;
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }

  async fetchByChave(): Promise<unknown> {
    return {};
  }

  async cancelar(): Promise<unknown> {
    return {};
  }

  async close(): Promise<void> {}
}

const authorizedResult = {
  status: 'ok',
  nfse: {
    chaveAcesso: '12345678901234567890123456789012345678901234567890',
    idDps: 'DPS354890608299621000120001000000000000001',
    xmlNfse: '<NFSe/>',
    alertas: [],
    tipoAmbiente: 2,
    versaoAplicativo: 'test',
    dataHoraProcessamento: new Date('2026-09-13T15:00:01Z'),
    nfse: {
      infNFSe: {
        nNFSe: '123',
        DPS: { infDPS: { dhEmi: new Date('2026-09-13T15:00:00Z') } },
      },
    },
  },
} as unknown as EmitirResult;

function createService(
  fakeClient?: FakeNfseClient,
  issuer: SharedFiscalIssuer = sharedIssuer,
): NfseClientService {
  const service = new NfseClientService(
    new EmptyNfseConfig() as unknown as ConfigService,
    {} as PostgresDpsCounterService,
    {} as PostgresRetryStoreService,
    new FakeSharedFiscalIssuerService(issuer) as SharedFiscalIssuerService,
  );
  if (fakeClient) {
    Reflect.set(service, 'client', fakeClient);
    Reflect.set(service, 'clientVersion', sharedIssuer.version);
  }
  return service;
}

function namedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

function buildRequest(): EmitirNfseRequest {
  return Object.assign(new EmitirNfseRequest(), {
    cTribNac: '010101',
    descricaoServico: 'Serviço de teste',
    codigoMunicipioPrestacao: '3548906',
    vServ: 800,
    aliqIss: 0,
    pTotTribSN: 6,
    nomeTomador: 'Maria Souza',
    docTomador: '987.654.321-00',
    emailTomador: 'maria@example.com',
  });
}

describe('NfseClientService', () => {
  it('converte o contrato HTTP para EmitirParams e normaliza a autorização', async () => {
    const fakeClient = new FakeNfseClient(authorizedResult);
    const service = createService(fakeClient);

    const response = await service.emitirNfse(buildRequest());

    expect(fakeClient.emitted).toMatchObject({
      emitente: {
        cnpj: '08299621000120',
        codMunicipio: '3548906',
        regime: { opSimpNac: '3', regApTribSN: '1', regEspTrib: '0' },
      },
      serie: '1',
      servico: {
        cTribNac: '010101',
        descricao: 'Serviço de teste',
        codMunicipioPrestacao: '3548906',
      },
      valores: { vServ: 800, pTotTribSN: 6 },
      tomador: {
        documento: { CPF: '98765432100' },
        nome: 'Maria Souza',
        email: 'maria@example.com',
      },
    });
    expect(fakeClient.emitted?.valores).not.toHaveProperty('aliqIss');
    expect(response).toEqual({
      status: 'AUTHORIZED',
      accessKey: '12345678901234567890123456789012345678901234567890',
      invoiceNumber: 123,
      series: '1',
      protocol: 'DPS354890608299621000120001000000000000001',
      issueDate: new Date('2026-09-13T15:00:00Z'),
      processingDate: new Date('2026-09-13T15:00:01Z'),
      serviceValue: 800,
      authorizedXml: '<NFSe/>',
    });
  });

  it('rejeita tomador sem CPF ou CNPJ antes de inicializar o certificado', async () => {
    const service = createService();
    const request = Object.assign(buildRequest(), {
      nomeTomador: 'JULIA JOIA BOIX',
      docTomador: undefined,
    });

    await expect(service.emitirNfse(request)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('omite a IM do prestador quando o emitente não habilita o envio (sendIm=false)', async () => {
    const fakeClient = new FakeNfseClient(authorizedResult);
    const service = createService(fakeClient, {
      ...sharedIssuer,
      sendIm: false,
    });

    await service.emitirNfse(buildRequest());

    expect(fakeClient.emitted?.emitente).not.toHaveProperty(
      'inscricaoMunicipal',
    );
  });

  // E0625: ME/EPP com ISSQN apurado pelo Simples não pode informar alíquota.
  it('omite a alíquota de ISS para ME/EPP apurado pelo Simples Nacional', async () => {
    const fakeClient = new FakeNfseClient(authorizedResult);
    const service = createService(fakeClient);

    await service.emitirNfse(buildRequest());

    expect(fakeClient.emitted?.valores).not.toHaveProperty('aliqIss');
  });

  it('envia a alíquota de ISS quando o emitente não é optante do Simples', async () => {
    const fakeClient = new FakeNfseClient(authorizedResult);
    const service = createService(fakeClient, {
      ...sharedIssuer,
      simpleNationalOption: '1',
      simpleNationalAssessmentRegime: '0',
    });
    const request = Object.assign(buildRequest(), {
      aliqIss: 2.5,
      pTotTribSN: undefined,
      pTotTribFed: 8,
      pTotTribEst: 3,
      pTotTribMun: 1.5,
    });

    await service.emitirNfse(request);

    expect(fakeClient.emitted?.valores).toMatchObject({
      aliqIss: 2.5,
      pTotTrib: { pTotTribFed: 8, pTotTribEst: 3, pTotTribMun: 1.5 },
    });
  });

  it('envia a IM do prestador quando o emitente habilita o envio (sendIm=true)', async () => {
    const fakeClient = new FakeNfseClient(authorizedResult);
    const service = createService(fakeClient, {
      ...sharedIssuer,
      sendIm: true,
    });

    await service.emitirNfse(buildRequest());

    expect(fakeClient.emitted?.emitente).toMatchObject({
      inscricaoMunicipal: '51197',
    });
  });

  it('retorna 503 quando o certificado compartilhado não está montado', async () => {
    await expect(
      createService().emitirNfse(buildRequest()),
    ).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({
        message: expect.stringContaining('/certs/missing.pfx'),
      }),
    });
  });

  it('retorna 503 quando o certificado está indisponível', async () => {
    const service = createService(
      new FakeNfseClient(
        namedError('InvalidCertificatePasswordError', 'Senha incorreta'),
      ),
    );

    await expect(service.emitirNfse(buildRequest())).rejects.toMatchObject({
      status: 503,
    });
  });

  it('retorna 422 quando a Receita rejeita os dados fiscais', async () => {
    const service = createService(
      new FakeNfseClient(
        namedError('ReceitaRejectionError', 'Código tributário inválido'),
      ),
    );

    await expect(service.emitirNfse(buildRequest())).rejects.toMatchObject({
      status: 422,
    });
  });

  it('retorna 422 quando o CPF do tomador falha na validação de dígitos', async () => {
    const service = createService(
      new FakeNfseClient(
        namedError(
          'InvalidCpfError',
          'CPF "12345678901" dígitos verificadores não conferem',
        ),
      ),
    );

    await expect(service.emitirNfse(buildRequest())).rejects.toMatchObject({
      status: 422,
    });
  });
});
