import { IsString, IsNotEmpty } from 'class-validator';

export class CancelarNfseRequest {
  @IsString()
  @IsNotEmpty()
  chaveAcesso!: string;

  @IsString()
  @IsNotEmpty()
  justificativa!: string;
}
