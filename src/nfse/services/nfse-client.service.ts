import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';

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
 *
 * A inicializacao do NfseClient eh lazy: a app sobe mesmo sem certificado
 * (util para health checks e ambientes locais). O certificado so eh lido
 * na primeira chamada que de fato precisa da lib.
 */
@Injectable()
export class NfseClientService {
  private readonly logger = new Logger(NfseClientService.name);
  private client: NfseClientInstance | null = null;
  private initializing: Promise<NfseClientInstance> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async consultarNfse(chaveAcesso: string): Promise<unknown> {
    const client = await this.getClient();
    return client.fetchByChave(chaveAcesso);
  }

  async emitirNfse(params: unknown): Promise<unknown> {
    const client = await this.getClient();
    return client.emitir(params);
  }

  async cancelarNfse(params: unknown): Promise<unknown> {
    const client = await this.getClient();
    return client.cancelar(params);
  }

  private async getClient(): Promise<NfseClientInstance> {
    if (this.client) return this.client;
    if (this.initializing) return this.initializing;
    this.initializing = this.initializeClient();
    try {
      this.client = await this.initializing;
      return this.client;
    } finally {
      this.initializing = null;
    }
  }

  private async initializeClient(): Promise<NfseClientInstance> {
    const certPath = this.configService.getOrThrow<string>('NFSE_CERT_PATH');
    const certPassword = this.configService.getOrThrow<string>('NFSE_CERT_PASSWORD');
    const ambienteStr = this.configService.get<string>('NFSE_AMBIENTE', '2');
    const ambiente: Ambiente = ambienteStr === '1' ? 1 : 2;

    if (!existsSync(certPath)) {
      throw new Error(`Certificado nao encontrado em '${certPath}' — verifique NFSE_CERT_PATH e o volume /certs`);
    }

    const openNfse = (await import('open-nfse')) as unknown as OpenNfseModule;
    const pfx = readFileSync(certPath);

    const client = new openNfse.NfseClient({
      ambiente: ambiente === 1 ? openNfse.Ambiente.Producao : openNfse.Ambiente.ProducaoRestrita,
      certificado: { pfx, password: certPassword },
      dpsCounter: openNfse.createInMemoryDpsCounter(),
      retryStore: openNfse.createInMemoryRetryStore(),
    });

    this.logger.log(`NfseClient inicializado (ambiente=${ambiente === 1 ? 'producao' : 'homologacao'})`);
    return client;
  }
}
