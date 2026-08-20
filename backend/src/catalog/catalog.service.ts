import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface TmdbFilme {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  overview: string;
}

interface TmdbBuscaResponse {
  results: TmdbFilme[];
}

export interface FilmeCatalogo {
  id: number;
  titulo: string;
  posterUrl: string | null;
  dataLancamento: string;
  sinopse: string;
}

@Injectable()
export class CatalogService {
  constructor(
    private http: HttpService,
    private config: ConfigService,
  ) {}

  async buscarFilmes(busca?: string): Promise<FilmeCatalogo[]> {
    const apiKey = this.config.get<string>('TMDB_API_KEY');
    const baseUrl = this.config.get<string>('TMDB_BASE_URL');

    if (!apiKey) {
      throw new InternalServerErrorException(
        'TMDB_API_KEY não configurada no servidor. Veja o README para obter uma chave gratuita.',
      );
    }

    const endpoint = busca ? '/search/movie' : '/movie/now_playing';
    const params: Record<string, string> = {
      api_key: apiKey,
      language: 'pt-BR',
    };
    if (busca) params.query = busca;

    const { data } = await firstValueFrom(
      this.http.get<TmdbBuscaResponse>(`${baseUrl}${endpoint}`, { params }),
    );

    return data.results.map((filme) => ({
      id: filme.id,
      titulo: filme.title,
      posterUrl: filme.poster_path
        ? `https://image.tmdb.org/t/p/w500${filme.poster_path}`
        : null,
      dataLancamento: filme.release_date,
      sinopse: filme.overview,
    }));
  }
}
