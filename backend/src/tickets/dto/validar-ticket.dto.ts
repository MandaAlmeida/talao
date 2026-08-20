import { IsString } from 'class-validator';

export class ValidarTicketDto {
  @IsString()
  codigo!: string;

  @IsString()
  eventoId!: string;
}
