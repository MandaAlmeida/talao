"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatarPeriodoEvento, seloEvento, type Evento } from "../_lib/eventos";

const INTERVALO_AUTOPLAY_MS = 5000;

export default function EventCarousel({ eventos }: { eventos: Evento[] }) {
  const [ativo, setAtivo] = useState(0);
  const [pausado, setPausado] = useState(false);

  const anterior = () =>
    setAtivo((i) => (i - 1 + eventos.length) % eventos.length);
  const proximo = () => setAtivo((i) => (i + 1) % eventos.length);
  const evento = eventos[ativo];

  useEffect(() => {
    if (pausado || eventos.length <= 1) return;

    const id = setInterval(() => {
      setAtivo((i) => (i + 1) % eventos.length);
    }, INTERVALO_AUTOPLAY_MS);

    return () => clearInterval(id);
  }, [pausado, eventos.length, ativo]);

  if (eventos.length === 0 || !evento) return null;

  return (
    <div
      className="w-full py-12"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <div className="relative flex h-72 items-center justify-center sm:h-96">
        <button
          type="button"
          onClick={anterior}
          aria-label="Evento anterior"
          className="absolute left-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-900 shadow-md transition-transform hover:scale-105 sm:left-8 dark:bg-zinc-800 dark:text-zinc-50"
        >
          <ChevronLeftIcon />
        </button>

        <div className="relative flex h-full w-full max-w-5xl items-center justify-center [perspective:1200px]">
          {eventos.map((e, i) => {
            const offset = i - ativo;
            const isActive = offset === 0;
            const abs = Math.abs(offset);

            if (abs > 2) return null;

            return (
              <div
                key={e.id}
                className="absolute h-full w-3/5 max-w-md transition-all duration-500 ease-out sm:w-2/5"
                style={{
                  transform: `translateX(${offset * 55}%) scale(${isActive ? 1 : 0.8}) rotateY(${offset * -25}deg)`,
                  zIndex: 10 - abs,
                  opacity: abs > 2 ? 0 : isActive ? 1 : 0.5,
                }}
              >
                {isActive ? (
                  <Link
                    href={`/eventos/${e.id}`}
                    className={`relative flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl bg-linear-to-br ${e.gradiente} p-6 text-white shadow-2xl`}
                  >
                    <EventPoster evento={e} />
                    <EventCardContent evento={e} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAtivo(i)}
                    aria-label={`Ir para ${e.titulo}`}
                    className={`relative flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl bg-linear-to-br ${e.gradiente} p-6 text-white shadow-xl`}
                  >
                    <EventPoster evento={e} />
                    <EventCardContent evento={e} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={proximo}
          aria-label="Próximo evento"
          className="absolute right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-900 shadow-md transition-transform hover:scale-105 sm:right-8 dark:bg-zinc-800 dark:text-zinc-50"
        >
          <ChevronRightIcon />
        </button>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2">
        {eventos.map((e, i) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setAtivo(i)}
            aria-label={`Ir para ${e.titulo}`}
            className={`h-2 rounded-full transition-all ${
              i === ativo
                ? "w-6 bg-zinc-900 dark:bg-zinc-50"
                : "w-2 bg-zinc-300 dark:bg-zinc-700"
            }`}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-col items-center gap-1 text-center">
        <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {evento.titulo}
        </h3>
        <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="flex items-center gap-1">
            <PinIcon />
            {evento.cidade}
          </span>
          <span className="flex items-center gap-1">
            <CalendarIcon />
            {formatarPeriodoEvento(evento.dataInicio, evento.dataFim)}
          </span>
        </div>
      </div>
    </div>
  );
}

function EventPoster({ evento }: { evento: Evento }) {
  const selo = seloEvento(evento);
  return (
    <>
      {evento.posterUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={evento.posterUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-black/10" />
        </>
      )}
      {selo && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-zinc-800/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          {selo}
        </span>
      )}
    </>
  );
}

function EventCardContent({ evento }: { evento: Evento }) {
  return (
    <>
      <span className="relative self-end rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
        {evento.cidade}
      </span>
      <span className="relative text-lg font-extrabold uppercase leading-tight drop-shadow-sm">
        {evento.titulo}
      </span>
    </>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function PinIcon() {
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
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
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
      className="h-4 w-4"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
