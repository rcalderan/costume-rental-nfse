import { Module } from '@nestjs/common';
import { NfseController } from './nfse.controller';
import { NfseClientService } from './services/nfse-client.service';
import { PostgresDpsCounterService } from './services/postgres-dps-counter.service';
import { PostgresRetryStoreService } from './services/postgres-retry-store.service';
import { SharedFiscalIssuerService } from './services/shared-fiscal-issuer.service';

@Module({
  controllers: [NfseController],
  providers: [
    NfseClientService,
    PostgresDpsCounterService,
    PostgresRetryStoreService,
    SharedFiscalIssuerService,
  ],
})
export class NfseModule {}
