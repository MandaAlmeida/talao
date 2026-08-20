"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import BookingStatusBadge from "../../_components/BookingStatusBadge";
import QRCodeDisplay from "../../_components/QRCodeDisplay";
import RequireRole from "../../_components/RequireRole";
import { ApiError } from "../../_lib/api-client";
import { buscarBookingDetalhado, type BookingDetalhado } from "../../_lib/bookings-store";
import { formatarDataEvento } from "../../_lib/eventos";

type Estado =
  | { status: "carregando" }
  | { status: "sucesso"; booking: BookingDetalhado }
  | { status: "erro" };

function ConteudoDetalheIngresso() {
  const params = useParams<{ id: string }>();
  const [estado, setEstado] = useState<Estado>({ status: "carregando" });

  useEffect(() => {
    let cancelado = false;
    buscarBookingDetalhado(params.id)
      .then((booking) => {
        if (!cancelado) setEstado({ status: "sucesso", booking });
      })
      .catch((err) => {
        if (cancelado) return;
        if (err instanceof ApiError && err.status === 404) {
          setEstado({ status: "erro" });
          return;
        }
        setEstado({ status: "erro" });
      });
    return () => {
      cancelado = true;
    };
  }, [params.id]);

  if (estado.status === "erro") notFound();
  if (estado.status === "carregando") {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Carregando ingresso…</p>
      </div>
    );
  }

  const { booking } = estado;
  const podeApresentar = booking.status === "CONFIRMADO";

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-md px-4 py-10">
        <Link
          href="/meus-ingressos"
          className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Meus ingressos
        </Link>

        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div
            className={`flex h-32 flex-col justify-end bg-linear-to-br p-5 text-white ${booking.evento.gradiente}`}
          >
            <h1 className="text-xl font-extrabold leading-tight">
              {booking.evento.titulo}
            </h1>
            <p className="mt-0.5 text-xs text-white/90">
              {formatarDataEvento(booking.evento.dataInicio)} a {formatarDataEvento(booking.evento.dataFim)} · {booking.evento.cidade}
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 border-b border-dashed border-zinc-200 p-6 dark:border-zinc-700">
            <QRCodeDisplay value={booking.codigoCompra} dim={!podeApresentar} />

            <BookingStatusBadge status={booking.status} />

            <p className="text-center font-mono text-sm tracking-widest text-zinc-700 dark:text-zinc-300">
              {booking.codigoCompra}
            </p>
            <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
              Apresente este código na entrada do evento
            </p>
          </div>

          <div className="flex flex-col gap-3 p-6">
            <Linha label="Tipo de ingresso" valor={booking.ticketType.nome} />
            <Linha
              label="Quantidade"
              valor={`${booking.quantidade} ${booking.quantidade > 1 ? "ingressos" : "ingresso"}`}
            />
            <Linha
              label="Local"
              valor={
                booking.evento.modalidade === "online"
                  ? "Evento online"
                  : booking.evento.endereco
                    ? `${booking.evento.endereco.rua}, ${booking.evento.endereco.numero}${booking.evento.endereco.bairro ? ` — ${booking.evento.endereco.bairro}` : ""}, ${booking.evento.endereco.cidade}/${booking.evento.endereco.estado}`
                    : booking.evento.cidade
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DetalheIngressoPage() {
  return (
    <RequireRole papel="cliente">
      <ConteudoDetalheIngresso />
    </RequireRole>
  );
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="font-medium text-zinc-900 dark:text-zinc-50">
        {valor}
      </span>
    </div>
  );
}
