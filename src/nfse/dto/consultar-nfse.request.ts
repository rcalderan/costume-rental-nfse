import { IsString, IsNotEmpty } from 'class-validator';

export class ConsultarNfseRequest {
  @IsString()
  @IsNotEmpty()
  chaveAcesso!: string;
}
