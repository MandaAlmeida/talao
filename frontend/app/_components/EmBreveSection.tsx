"use client";

import Link from "next/link";
import { formatarDataEvento, type Evento } from "../_lib/eventos";

export default function EmBreveSection({ eventos }: { eventos: Evento[] }) {
  if (eventos.length === 0) return null;

  return (
    <section className="w-full py-12">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Em breve
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Em breve
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Eventos que ainda não abriram para venda, mas já estão perto de começar.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {eventos.map((evento) => (
          <Link
            key={evento.id}
            href={`/eventos/${evento.id}`}
            className="group relative overflow-hidden rounded-xl border-2 border-amber-400 bg-white shadow-sm ring-1 ring-amber-400/30 transition-shadow hover:shadow-md dark:border-amber-500 dark:bg-zinc-900 dark:ring-amber-500/20"
          >
            <span className="absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-1.5 bg-amber-500 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
              <ClockIcon />
              Em breve
            </span>

            <div
              className={`relative flex h-32 items-start justify-end overflow-hidden bg-linear-to-br p-3 pt-9 ${evento.gradiente}`}
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
                {formatarDataEvento(evento.dataInicio)} a {formatarDataEvento(evento.dataFim)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ClockIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
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
