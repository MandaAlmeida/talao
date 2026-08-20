export type StatusEvento = "publicado" | "rascunho";
export type Modalidade = "presencial" | "online";
export type Publico = "geral" | "restrito";

export type TicketType = {
  id: string;
  nome: string;
  gratuito: boolean;
  preco: string;
  capacidade: number;
  vendaInicio: string | null;
  vendaFim: string | null;
  publico: Publico;
  descricao: string;
};

export function novoTicketType(): TicketType {
  return {
    id: crypto.randomUUID(),
    nome: "",
    gratuito: false,
    preco: "",
    capacidade: 0,
    vendaInicio: null,
    vendaFim: null,
    publico: "geral",
    descricao: "",
  };
}

export type Evento = {
  id: string;
  titulo: string;
  categoria: string;
  assunto: string | null;
  descricaoCompleta: string | null;
  status: StatusEvento;
  modalidade: Modalidade;
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
  ingressos: TicketType[];
};

export const categoriaLabel: Record<string, string> = {
  show: "Show",
  teatro: "Teatro",
  cinema: "Cinema",
  esporte: "Esporte",
  workshop: "Workshop",
  festa: "Festa",
  gastronomia: "Gastronomia",
  outro: "Outro",
};

export function formatarDataEvento(iso: string): string {
  const data = new Date(iso);
  const formatado = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(data);
  return formatado.replace(".", "").replace(/^(\d{2}) (\w)/, (_, dia, letra) => `${dia} de ${letra}`);
}

// Converte uma data ISO (UTC, como o backend envia) para o formato que
// <input type="datetime-local"> espera (YYYY-MM-DDTHH:mm, no fuso local do navegador).
export function isoParaDatetimeLocal(iso: string): string {
  const data = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const ano = data.getFullYear();
  const mes = pad(data.getMonth() + 1);
  const dia = pad(data.getDate());
  const hora = pad(data.getHours());
  const minuto = pad(data.getMinutes());
  return `${ano}-${mes}-${dia}T${hora}:${minuto}`;
}
