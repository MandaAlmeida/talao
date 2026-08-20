import { IsOptional, IsString } from 'class-validator';

export class ListarEventosDto {
  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsString()
  cidade?: string;

  @IsOptional()
  @IsString()
  busca?: string;
}
