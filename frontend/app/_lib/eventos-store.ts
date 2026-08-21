import { apiFetch } from "./api-client";
import type { Evento, EventoComMetricas, Publico, Sessao, SessaoComMetricas, StatusEvento, TicketType } from "./eventos";

type RolePublico = "GERAL" | "RESTRITO";
type RoleStatus = "RASCUNHO" | "EM_BREVE" | "PRE_VENDA" | "PUBLICADO";

type TicketTypeBackend = {
  id: string;
  nome: string;
  gratuito: boolean;
  preco: string;
  capacidade: number;
  vendaInicio: string | null;
  vendaFim: string | null;
  publico: RolePublico;
  descricao: string | null;
  fileiraInicio: string | null;
  fileiraFim: string | null;
};

type TicketTypeComMetricasBackend = TicketTypeBackend & { vendidos: number };

type SessaoBackend = {
  id: string;
  dataHora: string;
  sala: string | null;
  ticketTypes: TicketTypeBackend[];
};

type SessaoComMetricasBackend = Omit<SessaoBackend, "ticketTypes"> & {
  ticketTypes: TicketTypeComMetricasBackend[];
};

type EventoBackend = {
  id: string;
  titulo: string;
  categoria: string;
  assunto: string | null;
  descricaoCompleta: string | null;
  status: RoleStatus;
  modalidade: "presencial" | "online";
  cidade: string;
  endereco: { rua: string; numero: string; bairro?: string; cidade: string; estado: string } | null;
  linkAcesso: string | null;
  dataInicio: string;
  dataFim: string;
  gradiente: string;
  tmdbId: number | null;
  posterUrl: string | null;
  usaMapaAssentos: boolean;
  organizadorId: string;
  sessoes: SessaoBackend[];
  esgotado?: boolean;
};

type EventoComMetricasBackend = Omit<EventoBackend, "sessoes"> & {
  sessoes: SessaoComMetricasBackend[];
  totalVendidos: number;
  totalCapacidade: number;
  receitaTotal: number;
};

export type DadosEvento = {
  titulo: string;
  categoria: string;
  assunto?: string;
  descricaoCompleta?: string;
  modalidade: "presencial" | "online";
  cidade: string;
  endereco?: { rua: string; numero: string; bairro: string; cidade: string; estado: string };
  linkAcesso?: string;
  gradiente: string;
  tmdbId?: number;
  posterUrl?: string;
  usaMapaAssentos?: boolean;
  status?: StatusEvento;
  sessoes: {
    id?: string;
    dataHora: string;
    sala?: string;
    ingressos: {
      id?: string;
      nome: string;
      gratuito: boolean;
      preco: number;
      capacidade: number;
      vendaInicio?: string;
      vendaFim?: string;
      publico: Publico;
      descricao?: string;
      fileiraInicio?: string;
      fileiraFim?: string;
    }[];
  }[];
};

function publicoParaFrontend(publico: RolePublico): Publico {
  return publico.toLowerCase() as Publico;
}

function publicoParaBackend(publico: Publico): RolePublico {
  return publico.toUpperCase() as RolePublico;
}

const STATUS_PARA_FRONTEND: Record<RoleStatus, StatusEvento> = {
  RASCUNHO: "rascunho",
  EM_BREVE: "em-breve",
  PRE_VENDA: "pre-venda",
  PUBLICADO: "publicado",
};

const STATUS_PARA_BACKEND: Record<StatusEvento, RoleStatus> = {
  rascunho: "RASCUNHO",
  "em-breve": "EM_BREVE",
  "pre-venda": "PRE_VENDA",
  publicado: "PUBLICADO",
};

function statusParaFrontend(status: RoleStatus): StatusEvento {
  return STATUS_PARA_FRONTEND[status];
}

function statusParaBackend(status: StatusEvento): RoleStatus {
  return STATUS_PARA_BACKEND[status];
}

function ticketParaFrontend(ticket: TicketTypeBackend): TicketType {
  return {
    id: ticket.id,
    nome: ticket.nome,
    gratuito: ticket.gratuito,
    preco: ticket.preco,
    capacidade: ticket.capacidade,
    vendaInicio: ticket.vendaInicio,
    vendaFim: ticket.vendaFim,
    publico: publicoParaFrontend(ticket.publico),
    descricao: ticket.descricao ?? "",
    fileiraInicio: ticket.fileiraInicio,
    fileiraFim: ticket.fileiraFim,
  };
}

function sessaoParaFrontend(sessao: SessaoBackend): Sessao {
  return {
    id: sessao.id,
    dataHora: sessao.dataHora,
    sala: sessao.sala,
    ingressos: sessao.ticketTypes.map(ticketParaFrontend),
  };
}

function sessaoComMetricasParaFrontend(sessao: SessaoComMetricasBackend): SessaoComMetricas {
  return {
    id: sessao.id,
    dataHora: sessao.dataHora,
    sala: sessao.sala,
    ingressos: sessao.ticketTypes.map((tt) => ({
      ...ticketParaFrontend(tt),
      vendidos: tt.vendidos,
    })),
  };
}

function eventoParaFrontend(evento: EventoBackend): Evento {
  return {
    id: evento.id,
    titulo: evento.titulo,
    categoria: evento.categoria,
    assunto: evento.assunto,
    descricaoCompleta: evento.descricaoCompleta,
    status: statusParaFrontend(evento.status),
    modalidade: evento.modalidade,
    cidade: evento.cidade,
    endereco: evento.endereco,
    linkAcesso: evento.linkAcesso,
    dataInicio: evento.dataInicio,
    dataFim: evento.dataFim,
    gradiente: evento.gradiente,
    tmdbId: evento.tmdbId,
    posterUrl: evento.posterUrl,
    usaMapaAssentos: evento.usaMapaAssentos,
    organizadorId: evento.organizadorId,
    sessoes: evento.sessoes.map(sessaoParaFrontend),
    esgotado: evento.esgotado ?? false,
  };
}

function eventoComMetricasParaFrontend(evento: EventoComMetricasBackend): EventoComMetricas {
  return {
    ...eventoParaFrontend(evento),
    sessoes: evento.sessoes.map(sessaoComMetricasParaFrontend),
    totalVendidos: evento.totalVendidos,
    totalCapacidade: evento.totalCapacidade,
    receitaTotal: evento.receitaTotal,
  };
}

function dadosParaBackend(dados: DadosEvento) {
  return {
    ...dados,
    status: dados.status ? statusParaBackend(dados.status) : undefined,
    sessoes: dados.sessoes.map((s) => ({
      ...s,
      ingressos: s.ingressos.map((t) => ({
        ...t,
        publico: publicoParaBackend(t.publico),
      })),
    })),
  };
}

const eventosListeners = new Set<() => void>();
const meusEventosListeners = new Set<() => void>();
const emBreveListeners = new Set<() => void>();

const ARRAY_VAZIO: Evento[] = [];
const ARRAY_VAZIO_COM_METRICAS: EventoComMetricas[] = [];

let eventosCache: Evento[] = ARRAY_VAZIO;
let meusEventosCache: EventoComMetricas[] = ARRAY_VAZIO_COM_METRICAS;
let emBreveCache: Evento[] = ARRAY_VAZIO;

export function subscribeEventos(listener: () => void) {
  eventosListeners.add(listener);
  return () => eventosListeners.delete(listener);
}

export function getEventosSnapshot(): Evento[] {
  return eventosCache;
}

export function getEventosServerSnapshot(): Evento[] {
  return ARRAY_VAZIO;
}

export function subscribeMeusEventos(listener: () => void) {
  meusEventosListeners.add(listener);
  return () => meusEventosListeners.delete(listener);
}

export function getMeusEventosSnapshot(): EventoComMetricas[] {
  return meusEventosCache;
}

export function getMeusEventosServerSnapshot(): EventoComMetricas[] {
  return ARRAY_VAZIO_COM_METRICAS;
}

export async function carregarEventos(): Promise<void> {
  const eventos = await apiFetch<EventoBackend[]>("/events", { auth: false });
  eventosCache = eventos.map(eventoParaFrontend);
  eventosListeners.forEach((listener) => listener());
}

export function subscribeEmBreve(listener: () => void) {
  emBreveListeners.add(listener);
  return () => emBreveListeners.delete(listener);
}

export function getEmBreveSnapshot(): Evento[] {
  return emBreveCache;
}

export function getEmBreveServerSnapshot(): Evento[] {
  return ARRAY_VAZIO;
}

export async function carregarEmBreve(): Promise<void> {
  const eventos = await apiFetch<EventoBackend[]>("/events?status=em-breve", { auth: false });
  emBreveCache = eventos.map(eventoParaFrontend);
  emBreveListeners.forEach((listener) => listener());
}

export async function carregarMeusEventos(): Promise<void> {
  const eventos = await apiFetch<EventoComMetricasBackend[]>("/events/meus");
  meusEventosCache = eventos.map(eventoComMetricasParaFrontend);
  meusEventosListeners.forEach((listener) => listener());
}

export async function buscarEventoPorId(id: string): Promise<Evento> {
  const evento = await apiFetch<EventoBackend>(`/events/${id}`, { auth: false });
  return eventoParaFrontend(evento);
}

export async function criarEvento(dados: DadosEvento): Promise<Evento> {
  // status é extraído só para excluí-lo do payload; POST /events não aceita esse campo.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { status: _status, ...dadosCriacao } = dadosParaBackend(dados);
  const criado = await apiFetch<EventoBackend>("/events", {
    method: "POST",
    body: JSON.stringify(dadosCriacao),
  });

  // POST /events sempre cria em RASCUNHO (decisão do backend) — atualiza o status
  // em seguida para que "criar evento" continue sendo uma única ação do usuário.
  const publicado =
    dados.status && dados.status !== "rascunho"
      ? await apiFetch<EventoBackend>(`/events/${criado.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: statusParaBackend(dados.status) }),
        })
      : criado;

  await carregarMeusEventos();
  return eventoParaFrontend(publicado);
}

export async function atualizarEvento(id: string, dados: DadosEvento): Promise<Evento> {
  const evento = await apiFetch<EventoBackend>(`/events/${id}`, {
    method: "PATCH",
    body: JSON.stringify(dadosParaBackend(dados)),
  });
  await Promise.all([carregarEventos(), carregarMeusEventos()]);
  return eventoParaFrontend(evento);
}

export async function cancelarEvento(id: string): Promise<void> {
  await apiFetch<EventoBackend>(`/events/${id}`, { method: "DELETE" });
  await Promise.all([carregarEventos(), carregarMeusEventos()]);
}

export async function excluirEvento(id: string): Promise<void> {
  await apiFetch<void>(`/events/${id}/excluir`, { method: "DELETE" });
  await Promise.all([carregarEventos(), carregarMeusEventos()]);
}
