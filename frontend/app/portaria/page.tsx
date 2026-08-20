"use client";

import { useCallback, useState } from "react";
import CameraQrScanner from "../_components/CameraQrScanner";
import RequireRole from "../_components/RequireRole";
import Select from "../_components/form/Select";
import { ApiError } from "../_lib/api-client";
import { useEventos } from "../_lib/use-eventos";
import { validarTicket, type ResultadoValidacao } from "../_lib/tickets-store";

const situacaoConfig: Record<
  ResultadoValidacao["situacao"],
  { titulo: string; classes: string }
> = {
  valido: {
    titulo: "Ingresso válido",
    classes:
      "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
  },
  invalido: {
    titulo: "Ingresso inválido",
    classes:
      "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  },
  "ja-utilizado": {
    titulo: "Ingresso já utilizado",
    classes:
      "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  "evento-errado": {
    titulo: "Evento errado",
    classes:
      "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
  },
};

function ConteudoPortaria() {
  const eventos = useEventos();
  const [eventoId, setEventoId] = useState("");
  const [modo, setModo] = useState<"camera" | "manual">("manual");
  const [codigoManual, setCodigoManual] = useState("");
  const [resultado, setResultado] = useState<ResultadoValidacao | null>(null);
  const [historico, setHistorico] = useState<ResultadoValidacao[]>([]);
  const [validando, setValidando] = useState(false);
  const [erroValidacao, setErroValidacao] = useState("");

  const validarCodigo = useCallback(
    (codigoBruto: string) => {
      const codigo = codigoBruto.trim().toUpperCase();
      if (!codigo || !eventoId || validando) return;

      setValidando(true);
      setErroValidacao("");
      validarTicket(codigo, eventoId)
        .then((novoResultado) => {
          setResultado(novoResultado);
          setHistorico((prev) => [novoResultado, ...prev].slice(0, 10));
          setCodigoManual("");
        })
        .catch((err) => {
          setErroValidacao(
            err instanceof ApiError
              ? err.message
              : "Não foi possível validar o código agora.",
          );
        })
        .finally(() => setValidando(false));
    },
    [eventoId, validando],
  );

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validarCodigo(codigoManual);
  };

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-[#111111]">
      <main className="w-full max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          Portaria
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Valide os ingressos na entrada do evento.
        </p>

        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Evento
          </label>
          <div className="mt-1.5">
            <Select
              value={eventoId}
              onChange={(v) => {
                setEventoId(v);
                setResultado(null);
                setHistorico([]);
                setErroValidacao("");
              }}
              options={[
                { value: "", label: "Selecione o evento a validar" },
                ...eventos.map((e) => ({ value: e.id, label: e.titulo })),
              ]}
            />
          </div>
        </section>

        {eventoId && (
          <>
            <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="inline-flex rounded-lg border border-zinc-300 p-1 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setModo("manual")}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                    modo === "manual"
                      ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  Digitar código
                </button>
                <button
                  type="button"
                  onClick={() => setModo("camera")}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                    modo === "camera"
                      ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  Câmera
                </button>
              </div>

              {modo === "manual" ? (
                <form onSubmit={handleManualSubmit} className="mt-4 flex gap-2">
                  <input
                    type="text"
                    value={codigoManual}
                    onChange={(e) => setCodigoManual(e.target.value)}
                    placeholder="Ex: TLO-8834A2"
                    autoFocus
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-gray-900 dark:text-zinc-50"
                  />
                  <button
                    type="submit"
                    disabled={validando}
                    className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    {validando ? "Validando…" : "Validar"}
                  </button>
                </form>
              ) : (
                <div className="mt-4">
                  <CameraQrScanner
                    ativo={modo === "camera"}
                    onResultado={validarCodigo}
                  />
                </div>
              )}

              {erroValidacao && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                  {erroValidacao}
                </p>
              )}
            </section>

            {resultado && (
              <section
                className={`mt-6 rounded-xl border p-6 ${situacaoConfig[resultado.situacao].classes}`}
              >
                <p className="text-lg font-bold">
                  {situacaoConfig[resultado.situacao].titulo}
                </p>
                <p className="mt-1 text-sm">{resultado.mensagem}</p>
                {resultado.detalhe && (
                  <p className="mt-1 text-sm font-medium">
                    {resultado.detalhe}
                  </p>
                )}
                <p className="mt-2 font-mono text-xs opacity-75">
                  {resultado.codigo}
                </p>
              </section>
            )}

            {historico.length > 0 && (
              <section className="mt-6">
                <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Histórico da sessão
                </h2>
                <div className="mt-2 flex flex-col gap-2">
                  {historico.map((item, i) => (
                    <div
                      key={`${item.codigo}-${i}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                    >
                      <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        {item.codigo}
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          item.situacao === "valido"
                            ? "text-green-600 dark:text-green-400"
                            : item.situacao === "ja-utilizado"
                              ? "text-amber-600 dark:text-amber-400"
                              : item.situacao === "evento-errado"
                                ? "text-orange-600 dark:text-orange-400"
                                : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {situacaoConfig[item.situacao].titulo}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function PortariaPage() {
  return (
    <RequireRole papel="portaria">
      <ConteudoPortaria />
    </RequireRole>
  );
}
