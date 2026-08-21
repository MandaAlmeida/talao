"use client";

import { useParams, useSearchParams, notFound } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import SeatMap from "../../../_components/SeatMap";
import RequireRole from "../../../_components/RequireRole";
import {
  buscarDisponibilidade,
  buscarOrder,
  criarOrder,
  type Disponibilidade,
} from "../../../_lib/bookings-store";
import {
  cepValido,
  cpfValido,
  emailValido,
  formatarCep,
  formatarCpf,
  formatarTelefone,
  telefoneValido,
} from "../../../_lib/checkout-format";
import { ApiError } from "../../../_lib/api-client";
import { buscarCep } from "../../../_lib/cep-client";
import { formatarDataEvento, formatarDataHoraSessao } from "../../../_lib/eventos";
import type { TicketType } from "../../../_lib/eventos";
import { useEvento } from "../../../_lib/use-eventos";
import { getStripe } from "../../../_lib/stripe-client";

type Etapa = "selecao" | "pagamento" | "confirmando" | "sucesso" | "falha";

type ItemCarrinho = {
  ticketType: TicketType;
  quantidade: number;
  assentos: string[];
};

type ErrosComprador = {
  cpf?: string;
  email?: string;
  telefone?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
};

function ConteudoComprarIngresso() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const sessaoIdParam = searchParams.get("sessao");
  const { evento, carregando, erro } = useEvento(params.id);

  const [sessaoId, setSessaoId] = useState<string | null>(sessaoIdParam);
  const [etapa, setEtapa] = useState<Etapa>("selecao");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [ticketEmEdicaoId, setTicketEmEdicaoId] = useState<string | null>(null);
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade[]>([]);

  const sessaoSelecionada = evento?.sessoes.find((s) => s.id === sessaoId) ?? evento?.sessoes[0];

  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cep, setCep] = useState("");
  const cepConsultadoRef = useRef("");
  const [rua, setRua] = useState("");
  const [numeroEndereco, setNumeroEndereco] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  const [erros, setErros] = useState<ErrosComprador>({});
  const [erroReserva, setErroReserva] = useState("");
  const [criandoReserva, setCriandoReserva] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [bookingIds, setBookingIds] = useState<string[]>([]);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [tentativasEsgotadas, setTentativasEsgotadas] = useState(false);

  const usaAssentos = evento?.usaMapaAssentos ?? false;

  const itemEmEdicao = carrinho.find((i) => i.ticketType.id === ticketEmEdicaoId);

  useEffect(() => {
    if (!sessaoSelecionada) return;
    buscarDisponibilidade(sessaoSelecionada.id)
      .then(setDisponibilidade)
      .catch(() => {
        // erro de disponibilidade não bloqueia a seleção — o backend valida de novo ao reservar
      });
  }, [sessaoSelecionada]);

  const disponibilidadeTicket = disponibilidade.find(
    (d) => d.ticketTypeId === ticketEmEdicaoId,
  );
  const disponivel = disponibilidadeTicket?.disponivel ?? 0;
  const assentosOcupados = disponibilidadeTicket?.assentosOcupados ?? [];

  const precoItem = (item: ItemCarrinho) =>
    item.ticketType.gratuito ? 0 : (parseFloat(item.ticketType.preco) || 0) * item.quantidade;

  const totalCarrinho = useMemo(
    () => carrinho.reduce((soma, item) => soma + precoItem(item), 0),
    [carrinho],
  );

  const existeIngressoEsgotado = (sessaoSelecionada?.ingressos ?? []).some((ticket) => {
    const d = disponibilidade.find((item) => item.ticketTypeId === ticket.id);
    return d ? d.disponivel === 0 : false;
  });

  useEffect(() => {
    if (existeIngressoEsgotado) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [existeIngressoEsgotado]);

  useEffect(() => {
    if (etapa !== "confirmando" || !orderId) return;

    let tentativas = 0;
    const intervalo = setInterval(() => {
      tentativas += 1;
      buscarOrder(orderId)
        .then((order) => {
          if (order.status === "CONFIRMADO") {
            setEtapa("sucesso");
            clearInterval(intervalo);
          } else if (order.status === "CANCELADO" || order.status === "EXPIRADO") {
            setEtapa("falha");
            clearInterval(intervalo);
          } else if (tentativas >= 20) {
            setTentativasEsgotadas(true);
            clearInterval(intervalo);
          }
        })
        .catch(() => {
          // erro de rede pontual — tenta de novo na próxima iteração
        });
    }, 1500);

    return () => clearInterval(intervalo);
  }, [etapa, orderId]);

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

  const itemValido = (item: ItemCarrinho) =>
    item.quantidade > 0 && (!usaAssentos || item.assentos.length === item.quantidade);

  const podeAvancar =
    sessaoSelecionada !== undefined &&
    carrinho.length > 0 &&
    carrinho.every(itemValido);

  const itemEmEdicaoValido = itemEmEdicao
    ? itemEmEdicao.quantidade > 0 &&
      itemEmEdicao.quantidade <= disponivel &&
      (!usaAssentos || itemEmEdicao.assentos.length === itemEmEdicao.quantidade)
    : false;

  const toggleAssento = (codigo: string) => {
    if (!ticketEmEdicaoId) return;
    setCarrinho((prev) =>
      prev.map((item) =>
        item.ticketType.id !== ticketEmEdicaoId
          ? item
          : {
              ...item,
              assentos: item.assentos.includes(codigo)
                ? item.assentos.filter((a) => a !== codigo)
                : [...item.assentos, codigo],
            },
      ),
    );
  };

  const definirQuantidade = (quantidade: number) => {
    if (!ticketEmEdicaoId) return;
    setCarrinho((prev) =>
      prev.map((item) =>
        item.ticketType.id !== ticketEmEdicaoId
          ? item
          : { ...item, quantidade, assentos: item.assentos.slice(0, quantidade) },
      ),
    );
  };

  const abrirItem = (ticket: TicketType) => {
    setTicketEmEdicaoId(ticket.id);
    setCarrinho((prev) =>
      prev.some((i) => i.ticketType.id === ticket.id)
        ? prev
        : [...prev, { ticketType: ticket, quantidade: 1, assentos: [] }],
    );
  };

  const removerItem = (ticketTypeId: string) => {
    setCarrinho((prev) => prev.filter((i) => i.ticketType.id !== ticketTypeId));
    if (ticketEmEdicaoId === ticketTypeId) setTicketEmEdicaoId(null);
  };

  const validarDadosComprador = (): ErrosComprador => {
    const novosErros: ErrosComprador = {};

    if (!cpfValido(cpf)) novosErros.cpf = "Informe um CPF válido.";
    if (!emailValido(email)) novosErros.email = "Informe um e-mail válido.";
    if (!telefoneValido(telefone))
      novosErros.telefone = "Informe um telefone válido.";
    if (!cepValido(cep)) novosErros.cep = "Informe um CEP válido.";
    if (!rua.trim()) novosErros.rua = "Informe o endereço.";
    if (!numeroEndereco.trim()) novosErros.numero = "Informe o número.";
    if (!bairro.trim()) novosErros.bairro = "Informe o bairro.";
    if (!cidade.trim()) novosErros.cidade = "Informe a cidade.";
    if (!estado.trim()) novosErros.estado = "Informe o estado.";

    return novosErros;
  };

  const handleCepChange = (valor: string) => {
    const formatado = formatarCep(valor);
    setCep(formatado);

    if (formatado.replace(/\D/g, "").length === 8) {
      cepConsultadoRef.current = formatado;
      buscarCep(formatado).then((endereco) => {
        if (!endereco || cepConsultadoRef.current !== formatado) return;
        setRua(endereco.rua);
        setBairro(endereco.bairro);
        setCidade(endereco.cidade);
        setEstado(endereco.estado);
      });
    }
  };

  const irParaPagamento = async () => {
    if (!podeAvancar || !sessaoSelecionada) return;

    const novosErros = validarDadosComprador();
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setCriandoReserva(true);
    setErroReserva("");
    try {
      const order = await criarOrder(sessaoSelecionada.id, {
        itens: carrinho.map((item) => ({
          ticketTypeId: item.ticketType.id,
          quantidade: item.quantidade,
          assentos: usaAssentos ? item.assentos : undefined,
        })),
      });
      setOrderId(order.orderId);
      setBookingIds(order.bookingIds);
      if (order.clientSecret === null) {
        // Pedido 100% gratuito: o backend já confirma na hora, sem Stripe.
        setEtapa("sucesso");
      } else {
        setClientSecret(order.clientSecret);
        setEtapa("pagamento");
      }
    } catch (err) {
      setErroReserva(
        err instanceof ApiError
          ? err.message
          : "Não foi possível reservar os ingressos. Tente novamente.",
      );
      buscarDisponibilidade(sessaoSelecionada.id)
        .then(setDisponibilidade)
        .catch(() => {});
    } finally {
      setCriandoReserva(false);
    }
  };

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-[#111111]">
      <main className="w-full max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          {evento.titulo}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {formatarDataEvento(evento.dataInicio)} a{" "}
          {formatarDataEvento(evento.dataFim)} · {evento.cidade}
        </p>

        {etapa === "selecao" && (
          <div className="mt-6 flex flex-col gap-6">
            {erroReserva && (
              <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                {erroReserva}
              </div>
            )}

            {evento.sessoes.length > 1 && (
              <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Escolha a sessão
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {evento.sessoes.map((sessao) => (
                    <button
                      key={sessao.id}
                      type="button"
                      onClick={() => {
                        setSessaoId(sessao.id);
                        setCarrinho([]);
                        setTicketEmEdicaoId(null);
                      }}
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

            <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                Escolha o tipo de ingresso
              </h2>
              <div className="mt-4 flex flex-col gap-3">
                {ingressos.map((ticket) => {
                  const d = disponibilidade.find(
                    (item) => item.ticketTypeId === ticket.id,
                  );
                  const restam = d?.disponivel ?? ticket.capacidade;
                  const esgotado = restam === 0;

                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      disabled={esgotado}
                      onClick={() => abrirItem(ticket)}
                      className={`flex items-center justify-between rounded-lg border p-4 text-left transition-colors ${
                        esgotado
                          ? "cursor-not-allowed border-zinc-200 opacity-50 dark:border-zinc-800"
                          : carrinho.some((i) => i.ticketType.id === ticket.id)
                            ? "border-zinc-900 bg-zinc-50 dark:border-zinc-50 dark:bg-zinc-800"
                            : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                          {ticket.nome}
                        </p>
                        {ticket.descricao && (
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            {ticket.descricao}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                          {esgotado ? "Esgotado" : `${restam} disponíveis`}
                        </p>
                      </div>
                      <p className="font-bold text-zinc-900 dark:text-zinc-50">
                        {ticket.gratuito ? "Gratuito" : `R$ ${ticket.preco}`}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {itemEmEdicao && (
              <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {itemEmEdicao.ticketType.nome}
                </h2>

                <div className="mt-4 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => definirQuantidade(Math.max(1, itemEmEdicao.quantidade - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-lg font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {itemEmEdicao.quantidade}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      definirQuantidade(Math.min(disponivel, itemEmEdicao.quantidade + 1))
                    }
                    disabled={itemEmEdicao.quantidade >= disponivel}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-lg font-medium text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    +
                  </button>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {disponivel} disponíveis
                  </span>
                </div>

                {usaAssentos && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {itemEmEdicao.assentos.length}/{itemEmEdicao.quantidade} assentos selecionados
                    </p>
                    <div className="overflow-x-auto">
                      <SeatMap
                        selecionados={itemEmEdicao.assentos}
                        ocupados={assentosOcupados}
                        limite={itemEmEdicao.quantidade}
                        onToggle={toggleAssento}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    Subtotal ({itemEmEdicao.quantidade}{" "}
                    {itemEmEdicao.quantidade === 1 ? "ingresso" : "ingressos"})
                  </span>
                  <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    {precoItem(itemEmEdicao) === 0
                      ? "Gratuito"
                      : `R$ ${precoItem(itemEmEdicao).toFixed(2)}`}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setTicketEmEdicaoId(null)}
                  disabled={!itemEmEdicaoValido}
                  className="mt-4 w-full rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Adicionar ao carrinho
                </button>
              </section>
            )}

            {carrinho.length > 0 && (
              <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Seu carrinho
                </h2>
                <div className="mt-4 flex flex-col gap-2">
                  {carrinho.map((item) => (
                    <div
                      key={item.ticketType.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                    >
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {item.ticketType.nome} · {item.quantidade}{" "}
                          {item.quantidade === 1 ? "ingresso" : "ingressos"}
                        </p>
                        {usaAssentos && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Assentos: {item.assentos.join(", ") || "nenhum selecionado"}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                          {precoItem(item) === 0 ? "Gratuito" : `R$ ${precoItem(item).toFixed(2)}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setTicketEmEdicaoId(item.ticketType.id)}
                          className="text-xs font-medium text-zinc-600 underline dark:text-zinc-400"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => removerItem(item.ticketType.id)}
                          className="text-xs font-medium text-red-600 underline dark:text-red-400"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">Total</span>
                  <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    {totalCarrinho === 0 ? "Gratuito" : `R$ ${totalCarrinho.toFixed(2)}`}
                  </span>
                </div>

                <fieldset className="mt-6 flex flex-col gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <legend className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Dados do comprador
                  </legend>

                  <Campo label="CPF" error={erros.cpf}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cpf}
                      onChange={(e) => setCpf(formatarCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className={inputClass}
                    />
                  </Campo>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Campo label="E-mail" error={erros.email}>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="voce@email.com"
                        className={inputClass}
                      />
                    </Campo>
                    <Campo label="Telefone" error={erros.telefone}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={telefone}
                        onChange={(e) =>
                          setTelefone(formatarTelefone(e.target.value))
                        }
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                        className={inputClass}
                      />
                    </Campo>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Campo label="CEP" error={erros.cep}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cep}
                        onChange={(e) => handleCepChange(e.target.value)}
                        placeholder="00000-000"
                        maxLength={9}
                        className={inputClass}
                      />
                    </Campo>
                    <div className="sm:col-span-2">
                      <Campo label="Endereço" error={erros.rua}>
                        <input
                          type="text"
                          value={rua}
                          onChange={(e) => setRua(e.target.value)}
                          placeholder="Rua, avenida..."
                          className={inputClass}
                        />
                      </Campo>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Campo label="Número" error={erros.numero}>
                      <input
                        type="text"
                        value={numeroEndereco}
                        onChange={(e) => setNumeroEndereco(e.target.value)}
                        placeholder="Nº"
                        className={inputClass}
                      />
                    </Campo>
                    <Campo label="Bairro" error={erros.bairro}>
                      <input
                        type="text"
                        value={bairro}
                        onChange={(e) => setBairro(e.target.value)}
                        placeholder="Ex: Centro"
                        className={inputClass}
                      />
                    </Campo>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Campo label="Cidade" error={erros.cidade}>
                      <input
                        type="text"
                        value={cidade}
                        onChange={(e) => setCidade(e.target.value)}
                        placeholder="Ex: São Paulo"
                        className={inputClass}
                      />
                    </Campo>
                    <Campo label="Estado" error={erros.estado}>
                      <input
                        type="text"
                        value={estado}
                        onChange={(e) => setEstado(e.target.value)}
                        placeholder="Ex: SP"
                        className={inputClass}
                      />
                    </Campo>
                  </div>
                </fieldset>

                <button
                  type="button"
                  onClick={() => void irParaPagamento()}
                  disabled={!podeAvancar || criandoReserva}
                  className="mt-4 w-full rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  {criandoReserva ? "Reservando…" : "Continuar para pagamento"}
                </button>
              </section>
            )}
          </div>
        )}

        {etapa === "pagamento" && clientSecret && (
          <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <div>
                {carrinho.map((item) => (
                  <p key={item.ticketType.id} className="text-sm text-zinc-500 dark:text-zinc-400">
                    {item.ticketType.nome} · {item.quantidade}{" "}
                    {item.quantidade === 1 ? "ingresso" : "ingressos"}
                  </p>
                ))}
                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {totalCarrinho === 0 ? "Gratuito" : `R$ ${totalCarrinho.toFixed(2)}`}
                </p>
              </div>
            </div>

            <Elements stripe={getStripe()} options={{ clientSecret }}>
              <FormularioPagamentoStripe
                onSucesso={() => setEtapa("confirmando")}
                onVoltar={() => setEtapa("selecao")}
              />
            </Elements>
          </section>
        )}

        {etapa === "confirmando" && (
          <section className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-50" />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {tentativasEsgotadas
                ? 'A confirmação está demorando mais que o esperado — confira em "Meus ingressos" em alguns instantes.'
                : "Confirmando pagamento…"}
            </p>
          </section>
        )}

        {etapa === "falha" && (
          <section className="mt-6 flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950">
            <h2 className="text-xl font-bold text-red-900 dark:text-red-300">
              Pagamento não concluído
            </h2>
            <p className="text-sm text-red-800 dark:text-red-400">
              Não conseguimos confirmar o pagamento a tempo. Nenhuma cobrança
              foi mantida.
            </p>
            <button
              type="button"
              onClick={() => {
                setEtapa("selecao");
                setOrderId(null);
                setBookingIds([]);
                setClientSecret(null);
                setTentativasEsgotadas(false);
                if (sessaoSelecionada) {
                  buscarDisponibilidade(sessaoSelecionada.id)
                    .then(setDisponibilidade)
                    .catch(() => {});
                }
              }}
              className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              Tentar novamente
            </button>
          </section>
        )}

        {etapa === "sucesso" && (
          <section className="mt-6 flex flex-col items-center gap-4 rounded-xl border border-green-200 bg-green-50 p-8 text-center dark:border-green-900 dark:bg-green-950">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white">
              <CheckIcon />
            </div>
            <h2 className="text-xl font-bold text-green-900 dark:text-green-300">
              Pagamento aprovado!
            </h2>
            <p className="text-sm text-green-800 dark:text-green-400">
              Seu ingresso para {evento.titulo} foi confirmado.
            </p>
            {bookingIds.length > 0 && (
              <div className="mt-2 flex flex-col items-center gap-2">
                {bookingIds.map((id) => (
                  <Link
                    key={id}
                    href={`/meus-ingressos/${id}`}
                    className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    {bookingIds.length > 1 ? `Ver ingresso ${id.slice(0, 8)}` : "Ver meu ingresso"}
                  </Link>
                ))}
                <Link
                  href="/meus-ingressos"
                  className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
                >
                  Ver todos em Meus ingressos
                </Link>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function FormularioPagamentoStripe({
  onSucesso,
  onVoltar,
}: {
  onSucesso: () => void;
  onVoltar: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessando(true);
    setErro("");

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    setProcessando(false);

    if (error) {
      setErro(error.message ?? "Não foi possível confirmar o pagamento.");
      return;
    }

    onSucesso();
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="mt-4 flex flex-col gap-4"
    >
      <PaymentElement />
      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onVoltar}
          className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Voltar
        </button>
        <button
          type="submit"
          disabled={!stripe || processando}
          className="flex-1 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {processando ? "Processando…" : "Pagar"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-gray-900 dark:text-zinc-50";

function Campo({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function ComprarIngressoPage() {
  return (
    <RequireRole papel="cliente">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-[#111111]">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Carregando…
            </p>
          </div>
        }
      >
        <ConteudoComprarIngresso />
      </Suspense>
    </RequireRole>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
