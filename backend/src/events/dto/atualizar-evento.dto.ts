import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { EventStatus } from '@prisma/client';
import { CriarEventoDto } from './criar-evento.dto';

export class AtualizarEventoDto extends PartialType(CriarEventoDto) {
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
