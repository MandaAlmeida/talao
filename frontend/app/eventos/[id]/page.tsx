"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import {
  buscarDisponibilidade,
  type Disponibilidade,
} from "../../_lib/bookings-store";
import { categoriaLabel, formatarPeriodoEvento, formatarDataHoraSessao } from "../../_lib/eventos";
import { useEvento } from "../../_lib/use-eventos";
import { useEffect, useState } from "react";

export default function EventoPage() {
  const params = useParams<{ id: string }>();
  const { evento, carregando, erro } = useEvento(params.id);
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade[]>([]);

  const sessaoSelecionada = evento
    ? (evento.sessoes.find((s) => s.id === sessaoId) ?? evento.sessoes[0])
    : undefined;
  const sessaoSelecionadaId = sessaoSelecionada?.id;

  useEffect(() => {
    if (!sessaoSelecionadaId) return;
    buscarDisponibilidade(sessaoSelecionadaId)
      .then(setDisponibilidade)
      .catch(() => {
        // erro de disponibilidade não bloqueia a exibição do evento
      });
  }, [sessaoSelecionadaId]);

  if (erro) notFound();
  if (carregando || !evento) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-[#111111]">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Carregando evento…
        </p>
      </div>
    );
  }

  const ingressos = sessaoSelecionada?.ingressos ?? [];

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-[#111111]">
      <main className="w-full max-w-3xl px-4 py-10">
        <div
          className={`relative flex h-56 flex-col justify-end overflow-hidden rounded-2xl bg-linear-to-br p-6 text-white sm:h-72 ${evento.gradiente}`}
        >
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
          <span className="relative mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            {evento.modalidade === "online" ? "Online" : "Presencial"}
          </span>
          <h1 className="relative text-2xl font-extrabold leading-tight sm:text-3xl">
            {evento.titulo}
          </h1>
          {evento.assunto && (
            <p className="relative mt-1 text-sm text-white/90">
              {evento.assunto}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {evento.categoria && (
            <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {categoriaLabel[evento.categoria] ?? evento.categoria}
            </span>
          )}
        </div>

        {evento.descricaoCompleta && (
          <section className="mt-6">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Sobre o evento
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {evento.descricaoCompleta}
            </p>
          </section>
        )}

        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              <CalendarIcon />
              Data e hora
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {formatarPeriodoEvento(evento.dataInicio, evento.dataFim)}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              <PinIcon />
              Local
            </h3>
            {evento.modalidade === "online" ? (
              evento.linkAcesso ? (
                <a
                  href={evento.linkAcesso}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block truncate text-sm text-zinc-600 underline dark:text-zinc-400"
                >
                  {evento.linkAcesso}
                </a>
              ) : (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Link de acesso disponível após a compra.
                </p>
              )
            ) : (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {evento.endereco
                  ? `${evento.endereco.rua}, ${evento.endereco.numero}${evento.endereco.bairro ? ` — ${evento.endereco.bairro}` : ""}, ${evento.endereco.cidade}/${evento.endereco.estado}`
                  : evento.cidade}
              </p>
            )}
          </div>
        </section>

        {evento.sessoes.length > 1 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Sessões
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {evento.sessoes.map((sessao) => (
                <button
                  key={sessao.id}
                  type="button"
                  onClick={() => setSessaoId(sessao.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    sessao.id === sessaoSelecionada?.id
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                      : "border-zinc-300 text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {formatarDataHoraSessao(sessao.dataHora)}
                  {sessao.sala ? ` · ${sessao.sala}` : ""}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Ingressos
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {ingressos.map((ingresso) => {
              const d = disponibilidade.find(
                (item) => item.ticketTypeId === ingresso.id,
              );
              const restam = d?.disponivel ?? ingresso.capacidade;

              return (
                <div
                  key={ingresso.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {ingresso.nome}
                    </p>
                    {ingresso.descricao && (
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {ingresso.descricao}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                      {restam === 0 ? "Esgotado" : `${restam} disponíveis`}
                    </p>
                  </div>
                  <p className="font-bold text-zinc-900 dark:text-zinc-50">
                    {ingresso.gratuito ? "Gratuito" : `R$ ${ingresso.preco}`}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {evento.status === "em-breve" ? (
          <div className="mt-8 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-300">
            <p className="font-semibold">Este evento está em breve.</p>
            <p className="mt-1">
              As vendas ainda não abriram — volte em breve para garantir seu
              ingresso.
            </p>
          </div>
        ) : (
          <>
            <Link
              href={
                sessaoSelecionada
                  ? `/eventos/${evento.id}/comprar?sessao=${sessaoSelecionada.id}`
                  : `/eventos/${evento.id}/comprar`
              }
              className="mt-8 flex w-full items-center justify-center rounded-full bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 sm:w-auto dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Comprar ingresso
            </Link>
            {evento.status === "pre-venda" && (
              <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                Este evento está em pré-venda — garanta seu ingresso antes que
                as vendas abram para o público geral.
              </p>
            )}
          </>
        )}
      </main>
    </div>
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
