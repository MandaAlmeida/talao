import { apiFetch } from "./api-client";

export type StatusBooking = "PENDENTE" | "CONFIRMADO" | "CANCELADO" | "EXPIRADO" | "USADO";

export type Disponibilidade = {
  ticketTypeId: string;
  disponivel: number;
  assentosOcupados: string[];
};

export type Booking = {
  id: string;
  eventoId: string;
  ticketTypeId: string;
  quantidade: number;
  status: StatusBooking;
  codigoCompra: string;
  shareToken: string;
};

export type ReservaCriada = {
  bookingId: string;
  clientSecret: string | null;
  expiraEm: string | null;
};

export type DadosReserva = {
  ticketTypeId: string;
  quantidade?: number;
  assentos?: string[];
};

export async function buscarDisponibilidade(eventoId: string): Promise<Disponibilidade[]> {
  return apiFetch<Disponibilidade[]>(`/events/${eventoId}/disponibilidade`, { auth: false });
}

export async function criarReserva(eventoId: string, dados: DadosReserva): Promise<ReservaCriada> {
  return apiFetch<ReservaCriada>(`/events/${eventoId}/bookings`, {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function buscarBooking(id: string): Promise<Booking> {
  return apiFetch<Booking>(`/bookings/${id}`);
}

// Confirma o pagamento simulado (equivalente ao que um webhook do gateway faria em produção).
export async function confirmarPagamentoSimulado(bookingId: string): Promise<Booking> {
  return apiFetch<Booking>(`/payments/simular/${bookingId}/confirmar`, {
    method: "POST",
  });
}
