import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class EmitirNfseRequest {
  @IsString()
  @IsNotEmpty()
  cnpjEmitente!: string;

  @IsString()
  @IsNotEmpty()
  codigoMunicipio!: string;

  @IsString()
  @IsNotEmpty()
  serie!: string;

  @IsString()
  @IsNotEmpty()
  cTribNac!: string;

  @IsOptional()
  @IsString()
  cNBS?: string;

  @IsString()
  @IsNotEmpty()
  descricaoServico!: string;

  @IsNumber()
  @Min(0)
  vServ!: number;

  @IsNumber()
  @Min(0)
  aliqIss!: number;

  @IsOptional()
  @IsString()
  nomeTomador?: string;

  @IsOptional()
  @IsString()
  docTomador?: string;
}
