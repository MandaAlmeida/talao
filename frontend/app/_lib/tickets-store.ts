import { apiFetch } from "./api-client";

export type SituacaoValidacao = "valido" | "invalido" | "ja-utilizado" | "evento-errado";

export type ResultadoValidacao = {
  codigo: string;
  situacao: SituacaoValidacao;
  mensagem: string;
  detalhe?: string;
};

export async function validarTicket(codigo: string, eventoId: string): Promise<ResultadoValidacao> {
  return apiFetch<ResultadoValidacao>("/tickets/validar", {
    method: "POST",
    body: JSON.stringify({ codigo, eventoId }),
  });
}
