"use client";

import { useState } from "react";
import { ApiError, apiFetch } from "../../_lib/api-client";
import FormField, { inputClass } from "./FormField";

type FilmeCatalogo = {
  id: number;
  titulo: string;
  posterUrl: string | null;
  dataLancamento: string;
  sinopse: string;
};

export default function BuscaFilmeTmdb({
  onSelecionar,
}: {
  onSelecionar: (filme: {
    titulo: string;
    sinopse: string;
    tmdbId: number;
    posterUrl: string | null;
  }) => void;
}) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<FilmeCatalogo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const handleBuscar = async () => {
    setCarregando(true);
    setErro("");
    try {
      const filmes = await apiFetch<FilmeCatalogo[]>(
        `/catalog/filmes?busca=${encodeURIComponent(busca)}`,
      );
      setResultados(filmes);
    } catch (err) {
      setErro(
        err instanceof ApiError
          ? err.message
          : "Não foi possível buscar filmes agora.",
      );
      setResultados([]);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <FormField label="Buscar filme (TMDb)" error={erro || undefined}>
      <div className="flex gap-2">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleBuscar();
            }
          }}
          placeholder="Nome do filme"
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => void handleBuscar()}
          disabled={carregando || !busca.trim()}
          className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {carregando ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {resultados.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {resultados.map((filme) => (
            <button
              key={filme.id}
              type="button"
              onClick={() => {
                onSelecionar({
                  titulo: filme.titulo,
                  sinopse: filme.sinopse,
                  tmdbId: filme.id,
                  posterUrl: filme.posterUrl,
                });
                setResultados([]);
              }}
              className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 text-left transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
            >
              {filme.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={filme.posterUrl}
                  alt={filme.titulo}
                  className="h-32 w-full object-cover"
                />
              ) : (
                <div className="flex h-32 w-full items-center justify-center bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">
                  Sem pôster
                </div>
              )}
              <span className="px-2 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-50">
                {filme.titulo}
              </span>
            </button>
          ))}
        </div>
      )}
    </FormField>
  );
}
