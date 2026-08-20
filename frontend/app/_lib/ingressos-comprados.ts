import { CLIENTE_DEMO_ID } from "./auth-store";

export type StatusCompra = "confirmado" | "cancelado" | "usado";

export type IngressoComprado = {
  id: string;
  eventoId: string;
  ticketId: string;
  quantidade: number;
  status: StatusCompra;
  codigoCompra: string;
  clienteId: string;
  assentos?: string[];
};

export const ingressosComprados: IngressoComprado[] = [
  {
    id: "c1",
    eventoId: "1",
    ticketId: "1-vip",
    quantidade: 2,
    status: "confirmado",
    codigoCompra: "TLO-8834A2",
    clienteId: CLIENTE_DEMO_ID,
  },
  {
    id: "c2",
    eventoId: "5",
    ticketId: "5-pista",
    quantidade: 1,
    status: "confirmado",
    codigoCompra: "TLO-2291F0",
    clienteId: CLIENTE_DEMO_ID,
  },
  {
    id: "c3",
    eventoId: "9",
    ticketId: "9-entrada",
    quantidade: 3,
    status: "confirmado",
    codigoCompra: "TLO-7710B9",
    clienteId: CLIENTE_DEMO_ID,
  },
  {
    id: "c4",
    eventoId: "2",
    ticketId: "2-inteira",
    quantidade: 1,
    status: "cancelado",
    codigoCompra: "TLO-5567C3",
    clienteId: CLIENTE_DEMO_ID,
  },
];
