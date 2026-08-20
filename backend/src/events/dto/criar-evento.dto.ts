import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { TicketAudience } from '@prisma/client';

class EnderecoDto {
  @IsString()
  rua!: string;

  @IsString()
  numero!: string;

  @IsString()
  bairro!: string;

  @IsString()
  cidade!: string;

  @IsString()
  estado!: string;
}

class TicketTypeDto {
  @IsString()
  nome!: string;

  @IsBoolean()
  gratuito!: boolean;

  @IsNumber()
  @Min(0)
  preco!: number;

  @IsInt()
  @Min(1)
  capacidade!: number;

  @IsOptional()
  @IsDateString()
  vendaInicio?: string;

  @IsOptional()
  @IsDateString()
  vendaFim?: string;

  @IsEnum(TicketAudience)
  publico!: TicketAudience;

  @IsOptional()
  @IsString()
  descricao?: string;
}

export class CriarEventoDto {
  @IsString()
  titulo!: string;

  @IsString()
  categoria!: string;

  @IsOptional()
  @IsString()
  assunto?: string;

  @IsOptional()
  @IsString()
  descricaoCompleta?: string;

  @IsIn(['presencial', 'online'])
  modalidade!: 'presencial' | 'online';

  @IsString()
  cidade!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EnderecoDto)
  endereco?: EnderecoDto;

  @IsOptional()
  @IsString()
  linkAcesso?: string;

  @IsDateString()
  dataInicio!: string;

  @IsDateString()
  dataFim!: string;

  @IsString()
  gradiente!: string;

  @IsOptional()
  @IsInt()
  tmdbId?: number;

  @IsOptional()
  @IsString()
  posterUrl?: string;

  @IsOptional()
  @IsBoolean()
  usaMapaAssentos?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TicketTypeDto)
  ingressos!: TicketTypeDto[];
}
