import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class EmitirNfseRequest {
  /**
   * Código de Tributação Nacional (6 dígitos). Quando ausente, o backend usa
   * o valor configurado no emitente (sistema/cnpj).
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  cTribNac?: string;

  @IsOptional()
  @IsString()
  cNBS?: string;

  /**
   * Descrição do serviço. Quando ausente, o backend usa a descrição padrão
   * configurada no emitente.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  descricaoServico?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{7}$/)
  codigoMunicipioPrestacao?: string;

  @IsNumber()
  @Min(0.01)
  vServ!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  aliqIss?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pTotTribSN?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pTotTribFed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pTotTribEst?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pTotTribMun?: number;

  @IsOptional()
  @IsString()
  nomeTomador?: string;

  @IsOptional()
  @IsString()
  docTomador?: string;

  @IsOptional()
  @IsEmail()
  emailTomador?: string;
}
