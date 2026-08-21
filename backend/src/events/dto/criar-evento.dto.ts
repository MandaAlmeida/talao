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

  @IsOptional()
  @IsIn(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
  fileiraInicio?: string;

  @IsOptional()
  @IsIn(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
  fileiraFim?: string;
}

class SessaoDto {
  @IsDateString()
  dataHora!: string;

  @IsOptional()
  @IsString()
  sala?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TicketTypeDto)
  ingressos!: TicketTypeDto[];
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

  // Uma ou mais sessões (exibições concretas) do evento — um show único tem
  // uma sessão só; um filme em cartaz diário/teatro tem várias, cada uma com
  // sua data/hora, sala e tipos de ingresso próprios.
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SessaoDto)
  sessoes!: SessaoDto[];
}
