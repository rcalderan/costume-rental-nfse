import { Module } from '@nestjs/common';
import { NfseController } from './nfse.controller';
import { NfseClientService } from './services/nfse-client.service';

@Module({
  controllers: [NfseController],
  providers: [NfseClientService],
})
export class NfseModule {}
