"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  categoriaLabel,
  formatarDataEvento,
  type Evento,
} from "../_lib/eventos";
import Select from "./form/Select";

export default function EventList({ eventos }: { eventos: Evento[] }) {
  const [busca, setBusca] = useState("");
  const [local, setLocal] = useState("todos");
  const [categoria, setCategoria] = useState("todas");

  const cidades = useMemo(
    () => Array.from(new Set(eventos.map((e) => e.cidade))).sort(),
    [eventos],
  );

  const categorias = useMemo(
    () =>
      Array.from(
        new Set(
          eventos
            .map((e) => e.categoria)
            .filter((c): c is string => Boolean(c)),
        ),
      ).sort(),
    [eventos],
  );

  const eventosFiltrados = useMemo(() => {
    const buscaNormalizada = busca.trim().toLowerCase();
    return eventos.filter((e) => {
      const combinaBusca =
        buscaNormalizada === "" ||
        e.titulo.toLowerCase().includes(buscaNormalizada);
      const combinaLocal = local === "todos" || e.cidade === local;
      const combinaCategoria =
        categoria === "todas" || e.categoria === categoria;
      return combinaBusca && combinaLocal && combinaCategoria;
    });
  }, [eventos, busca, local, categoria]);

  return (
    <section className="w-full py-12">
      <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Todos os eventos
      </h2>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar evento pelo título..."
            className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-gray-900 dark:text-zinc-50"
          />
        </div>

        <Select
          value={local}
          onChange={setLocal}
          className="sm:w-56"
          options={[
            { value: "todos", label: "Todos os locais" },
            ...cidades.map((cidade) => ({ value: cidade, label: cidade })),
          ]}
        />

        <Select
          value={categoria}
          onChange={setCategoria}
          className="sm:w-56"
          options={[
            { value: "todas", label: "Todas as categorias" },
            ...categorias.map((cat) => ({
              value: cat,
              label: categoriaLabel[cat] ?? cat,
            })),
          ]}
        />
      </div>

      {eventosFiltrados.length === 0 ? (
        <p className="mt-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Nenhum evento encontrado.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {eventosFiltrados.map((evento) => (
            <Link
              key={evento.id}
              href={`/eventos/${evento.id}`}
              className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div
                className={`relative flex h-32 items-start justify-end overflow-hidden bg-linear-to-br p-3 ${evento.gradiente}`}
              >
                {evento.posterUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={evento.posterUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-black/5" />
                  </>
                )}
                <span className="relative rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                  {evento.cidade}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-zinc-900 group-hover:underline dark:text-zinc-50">
                  {evento.titulo}
                </h3>
                <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <CalendarIcon />
                  {formatarDataEvento(evento.dataInicio)} a{" "}
                  {formatarDataEvento(evento.dataFim)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
