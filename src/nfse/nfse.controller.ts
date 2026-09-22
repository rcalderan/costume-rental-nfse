import { Body, Controller, Get, Param, Post, Logger } from '@nestjs/common';
import { NfseClientService } from './services/nfse-client.service';
import { EmitirNfseRequest } from './dto/emitir-nfse.request';
import { ConsultarNfseRequest } from './dto/consultar-nfse.request';
import { CancelarNfseRequest } from './dto/cancelar-nfse.request';
import { EmitirNfseResponse } from './dto/emitir-nfse.response';

@Controller('nfse')
export class NfseController {
  private readonly logger = new Logger(NfseController.name);

  constructor(private readonly nfseClient: NfseClientService) {}

  @Post('emit')
  async emitir(
    @Body() request: EmitirNfseRequest,
  ): Promise<EmitirNfseResponse> {
    this.logger.log(
      `emitir: cTribNac=${request.cTribNac ?? 'emitente'} municipioPrestacao=${request.codigoMunicipioPrestacao ?? 'emitente'}`,
    );
    return this.nfseClient.emitirNfse(request);
  }

  @Post('consult')
  async consultar(@Body() request: ConsultarNfseRequest): Promise<unknown> {
    this.logger.log(`consultar: chave=${request.chaveAcesso}`);
    return this.nfseClient.consultarNfse(request.chaveAcesso);
  }

  @Get('consult/:chaveAcesso')
  async consultarByPath(
    @Param('chaveAcesso') chaveAcesso: string,
  ): Promise<unknown> {
    this.logger.log(`consultarByPath: chave=${chaveAcesso}`);
    return this.nfseClient.consultarNfse(chaveAcesso);
  }

  @Post('cancel')
  async cancelar(@Body() request: CancelarNfseRequest): Promise<unknown> {
    this.logger.log(`cancelar: chave=${request.chaveAcesso}`);
    return this.nfseClient.cancelarNfse(request);
  }
}
