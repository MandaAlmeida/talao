"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BookingStatusBadge from "../_components/BookingStatusBadge";
import ConfirmModal from "../_components/ConfirmModal";
import RequireRole from "../_components/RequireRole";
import { ApiError } from "../_lib/api-client";
import {
  buscarMinhasBookings,
  cancelarBooking,
  type BookingDetalhado,
} from "../_lib/bookings-store";
import { formatarDataEvento } from "../_lib/eventos";

function podeCancelar(booking: BookingDetalhado, agora: number): boolean {
  return (
    (booking.status === "CONFIRMADO" || booking.status === "PENDENTE") &&
    new Date(booking.evento.dataInicio).getTime() > agora
  );
}

function ConteudoMeusIngressos() {
  const [bookings, setBookings] = useState<BookingDetalhado[] | null>(null);
  const [erro, setErro] = useState("");
  const [bookingParaCancelar, setBookingParaCancelar] = useState<string | null>(
    null,
  );
  const [cancelando, setCancelando] = useState(false);
  const [erroCancelamento, setErroCancelamento] = useState("");
  const [agora] = useState(() => Date.now());

  useEffect(() => {
    buscarMinhasBookings()
      .then(setBookings)
      .catch((err) => {
        setErro(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar seus ingressos.",
        );
      });
  }, []);

  const confirmarCancelamento = async () => {
    if (!bookingParaCancelar) return;
    setCancelando(true);
    setErroCancelamento("");
    try {
      await cancelarBooking(bookingParaCancelar);
      setBookings(
        (prev) =>
          prev?.map((b) =>
            b.id === bookingParaCancelar ? { ...b, status: "CANCELADO" } : b,
          ) ?? null,
      );
      setBookingParaCancelar(null);
    } catch (err) {
      setErroCancelamento(
        err instanceof ApiError
          ? err.message
          : "Não foi possível cancelar o ingresso. Tente novamente.",
      );
    } finally {
      setCancelando(false);
    }
  };

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-[#111111]">
      <main className="w-full max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          Meus ingressos
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Ingressos que você comprou para eventos.
        </p>

        {erro && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {erro}
          </div>
        )}

        {erroCancelamento && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {erroCancelamento}
          </div>
        )}

        {bookings === null && !erro && (
          <p className="mt-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Carregando…
          </p>
        )}

        {bookings !== null && bookings.length === 0 && (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Você ainda não comprou nenhum ingresso.
            </p>
            <Link
              href="/"
              className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              Ver eventos
            </Link>
          </div>
        )}

        {bookings !== null && bookings.length > 0 && (
          <div className="mt-8 flex flex-col gap-4">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div
                  className={`relative h-28 w-full shrink-0 overflow-hidden rounded-lg bg-linear-to-br sm:h-20 sm:w-32 ${booking.evento.gradiente}`}
                >
                  {booking.evento.posterUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={booking.evento.posterUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-zinc-900 dark:text-zinc-50">
                      {booking.evento.titulo}
                    </h2>
                    <BookingStatusBadge status={booking.status} />
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{booking.evento.cidade}</span>
                    <span>
                      {formatarDataEvento(booking.evento.dataInicio)} a{" "}
                      {formatarDataEvento(booking.evento.dataFim)}
                    </span>
                  </p>
                  <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                    {booking.ticketType.nome} · {booking.quantidade}{" "}
                    {booking.quantidade > 1 ? "ingressos" : "ingresso"}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                    Código: {booking.codigoCompra}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <Link
                    href={`/meus-ingressos/${booking.id}`}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    Ver ingresso
                  </Link>
                  <Link
                    href={`/eventos/${booking.evento.id}`}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Ver evento
                  </Link>
                  {podeCancelar(booking, agora) && (
                    <button
                      type="button"
                      onClick={() => setBookingParaCancelar(booking.id)}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      Cancelar ingresso
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {bookingParaCancelar && (
        <ConfirmModal
          title="Cancelar ingresso"
          description="Tem certeza que deseja cancelar este ingresso? Se o pagamento já foi confirmado, o valor será reembolsado automaticamente. Essa ação não pode ser desfeita."
          confirmLabel={cancelando ? "Cancelando…" : "Sim, cancelar"}
          onConfirm={() => void confirmarCancelamento()}
          onCancel={() => setBookingParaCancelar(null)}
        />
      )}
    </div>
  );
}

export default function MeusIngressosPage() {
  return (
    <RequireRole papel="cliente">
      <ConteudoMeusIngressos />
    </RequireRole>
  );
}
