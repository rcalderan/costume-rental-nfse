import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';

type Ambiente = 1 | 2;
interface NfseClientInstance {
  fetchByChave: (chave: string) => Promise<unknown>;
  emitir: (params: unknown) => Promise<unknown>;
  cancelar: (params: unknown) => Promise<unknown>;
  close: () => Promise<void>;
}

interface OpenNfseModule {
  NfseClient: new (config: unknown) => NfseClientInstance;
  Ambiente: { Producao: Ambiente; ProducaoRestrita: Ambiente };
  createInMemoryDpsCounter: () => unknown;
  createInMemoryRetryStore: () => unknown;
}

/**
 * Wrapper da biblioteca open-nfse (ESM) carregada via dynamic import.
 * Isola a lib terceira da camada de controllers, seguindo o padrao
 * NfeLibraryAdapter do costume-rental-nfe (Java).
 */
@Injectable()
export class NfseClientService implements OnModuleInit {
  private readonly logger = new Logger(NfseClientService.name);
  private client: NfseClientInstance | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    const certPath = this.configService.getOrThrow<string>('NFSE_CERT_PATH');
    const certPassword = this.configService.getOrThrow<string>('NFSE_CERT_PASSWORD');
    const ambienteStr = this.configService.get<string>('NFSE_AMBIENTE', '2');
    const ambiente: Ambiente = ambienteStr === '1' ? 1 : 2;

    const openNfse = (await import('open-nfse')) as unknown as OpenNfseModule;
    const pfx = readFileSync(certPath);

    this.client = new openNfse.NfseClient({
      ambiente: ambiente === 1 ? openNfse.Ambiente.Producao : openNfse.Ambiente.ProducaoRestrita,
      certificado: { pfx, password: certPassword },
      dpsCounter: openNfse.createInMemoryDpsCounter(),
      retryStore: openNfse.createInMemoryRetryStore(),
    });

    this.logger.log(`NfseClient inicializado (ambiente=${ambiente === 1 ? 'producao' : 'homologacao'})`);
  }

  async consultarNfse(chaveAcesso: string): Promise<unknown> {
    this.ensureClient();
    return this.client!.fetchByChave(chaveAcesso);
  }

  async emitirNfse(params: unknown): Promise<unknown> {
    this.ensureClient();
    return this.client!.emitir(params);
  }

  async cancelarNfse(params: unknown): Promise<unknown> {
    this.ensureClient();
    return this.client!.cancelar(params);
  }

  private ensureClient(): void {
    if (!this.client) {
      throw new Error('NfseClient nao inicializado — verifique NFSE_CERT_PATH e NFSE_CERT_PASSWORD');
    }
  }
}
