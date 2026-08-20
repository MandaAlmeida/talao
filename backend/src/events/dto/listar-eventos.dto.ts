import { IsIn, IsOptional, IsString } from 'class-validator';

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

  // Por padrão a listagem pública mostra só PUBLICADO. Passe 'em-breve' para
  // listar eventos que ainda não abriram vendas (usado na seção "Em breve" da home).
  @IsOptional()
  @IsIn(['em-breve'])
  status?: 'em-breve';
}
