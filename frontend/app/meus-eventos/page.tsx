"use client";

import Link from "next/link";
import RequireRole from "../_components/RequireRole";
import StatusBadge from "../_components/StatusBadge";
import { formatarPeriodoEvento } from "../_lib/eventos";
import { useMeusEventos } from "../_lib/use-eventos";

function ConteudoMeusEventos() {
  const meusEventos = useMeusEventos();

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-[#111111]">
      <main className="w-full max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              Meus eventos
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Eventos que você criou e gerencia.
            </p>
          </div>
          <Link
            href="/criar-evento"
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            + Criar evento
          </Link>
        </div>

        {meusEventos.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Você ainda não criou nenhum evento.
            </p>
            <Link
              href="/criar-evento"
              className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              Criar meu primeiro evento
            </Link>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-4">
            {meusEventos.map((evento) => (
              <div
                key={evento.id}
                className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div
                  className={`relative h-28 w-full shrink-0 overflow-hidden rounded-lg bg-linear-to-br sm:h-20 sm:w-32 ${evento.gradiente}`}
                >
                  {evento.posterUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={evento.posterUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-zinc-900 dark:text-zinc-50">
                      {evento.titulo}
                    </h2>
                    <StatusBadge status={evento.status} />
                  </div>
                  <p className="mt-1 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{evento.cidade}</span>
                    <span>
                      {formatarPeriodoEvento(evento.dataInicio, evento.dataFim)}
                    </span>
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {evento.totalVendidos} / {evento.totalCapacidade}{" "}
                      ingressos vendidos
                    </span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {evento.receitaTotal.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}{" "}
                      arrecadados
                    </span>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/eventos/${evento.id}`}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Ver
                  </Link>
                  <Link
                    href={`/eventos/${evento.id}/editar`}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    Editar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function MeusEventosPage() {
  return (
    <RequireRole papel="organizador">
      <ConteudoMeusEventos />
    </RequireRole>
  );
}
