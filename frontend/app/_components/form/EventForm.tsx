"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  isoParaDatetimeLocal,
  novoTicketType,
  type Evento,
  type Modalidade,
  type StatusEvento,
  type TicketType,
} from "../../_lib/eventos";
import {
  atualizarEvento,
  criarEvento,
  excluirEvento,
  type DadosEvento,
} from "../../_lib/eventos-store";
import { ApiError } from "../../_lib/api-client";
import { buscarCep } from "../../_lib/cep-client";
import { formatarCep } from "../../_lib/checkout-format";
import { useUsuario } from "../../_lib/use-auth";
import BuscaFilmeTmdb from "./BuscaFilmeTmdb";
import ConfirmModal from "../ConfirmModal";
import FormField, { dateInputClass, inputClass } from "./FormField";
import FormSection from "./FormSection";
import SegmentedControl from "./SegmentedControl";
import TicketTypeCard from "./TicketTypeCard";
import Toggle from "./Toggle";

type Erros = {
  nome?: string;
  assunto?: string;
  descricao?: string;
  dataInicio?: string;
  dataFim?: string;
  rua?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  tickets?: Record<string, Partial<Record<keyof TicketType, string>>>;
  geral?: string;
};

export default function EventForm({
  modo,
  eventoInicial,
}: {
  modo: "criar" | "editar";
  eventoInicial?: Evento;
}) {
  const router = useRouter();
  const usuario = useUsuario();
  const [nome, setNome] = useState(eventoInicial?.titulo ?? "");
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [assunto, setAssunto] = useState(eventoInicial?.assunto ?? "");
  const [categoria, setCategoria] = useState(eventoInicial?.categoria ?? "");
  const [descricao, setDescricao] = useState(
    eventoInicial?.descricaoCompleta ?? "",
  );
  const [tmdbId, setTmdbId] = useState<number | undefined>(
    eventoInicial?.tmdbId ?? undefined,
  );
  const [posterUrl, setPosterUrl] = useState<string | undefined>(
    eventoInicial?.posterUrl ?? undefined,
  );
  const [usaMapaAssentos, setUsaMapaAssentos] = useState(
    eventoInicial?.usaMapaAssentos ?? false,
  );
  const [status, setStatus] = useState<StatusEvento>(
    eventoInicial?.status ?? "publicado",
  );

  const [modalidade, setModalidade] = useState<Modalidade>(
    eventoInicial?.modalidade ?? "presencial",
  );
  const [dataInicio, setDataInicio] = useState(
    eventoInicial ? isoParaDatetimeLocal(eventoInicial.dataInicio) : "",
  );
  const [dataFim, setDataFim] = useState(
    eventoInicial ? isoParaDatetimeLocal(eventoInicial.dataFim) : "",
  );
  const [cep, setCep] = useState("");
  const cepConsultadoRef = useRef("");
  const [rua, setRua] = useState(eventoInicial?.endereco?.rua ?? "");
  const [numero, setNumero] = useState(eventoInicial?.endereco?.numero ?? "");
  const [bairro, setBairro] = useState(eventoInicial?.endereco?.bairro ?? "");
  const [cidade, setCidade] = useState(eventoInicial?.endereco?.cidade ?? "");
  const [estado, setEstado] = useState(eventoInicial?.endereco?.estado ?? "");
  const [linkAcesso, setLinkAcesso] = useState(
    eventoInicial?.linkAcesso ?? "",
  );

  const [tickets, setTickets] = useState<TicketType[]>(
    eventoInicial?.ingressos && eventoInicial.ingressos.length > 0
      ? eventoInicial.ingressos.map((t) => ({
          ...t,
          vendaInicio: t.vendaInicio ? isoParaDatetimeLocal(t.vendaInicio) : null,
          vendaFim: t.vendaFim ? isoParaDatetimeLocal(t.vendaFim) : null,
        }))
      : [novoTicketType()],
  );

  const [erros, setErros] = useState<Erros>({});
  const [sucesso, setSucesso] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const handleImagem = (file: File | undefined) => {
    if (!file) return;
    setImagemPreview(URL.createObjectURL(file));
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

  const atualizarTicket = (ticket: TicketType) => {
    setTickets((prev) => prev.map((t) => (t.id === ticket.id ? ticket : t)));
  };

  const removerTicket = (id: string) => {
    setTickets((prev) => prev.filter((t) => t.id !== id));
  };

  const validar = (): Erros => {
    const novosErros: Erros = {};

    if (!nome.trim()) novosErros.nome = "Informe o nome do evento.";
    if (!assunto.trim()) novosErros.assunto = "Informe o assunto do evento.";
    if (!descricao.trim())
      novosErros.descricao = "Informe a descrição do evento.";
    if (!dataInicio) novosErros.dataInicio = "Informe a data/hora de início.";
    if (!dataFim) novosErros.dataFim = "Informe a data/hora de fim.";

    if (modalidade === "presencial") {
      if (!rua.trim()) novosErros.rua = "Informe o endereço.";
      if (!bairro.trim()) novosErros.bairro = "Informe o bairro.";
      if (!cidade.trim()) novosErros.cidade = "Informe a cidade.";
      if (!estado.trim()) novosErros.estado = "Informe o estado.";
    }

    const ticketErros: Record<
      string,
      Partial<Record<keyof TicketType, string>>
    > = {};
    for (const ticket of tickets) {
      const e: Partial<Record<keyof TicketType, string>> = {};
      if (!ticket.nome.trim()) e.nome = "Informe o nome do ingresso.";
      if (!ticket.gratuito && !ticket.preco)
        e.preco = "Informe o preço do ingresso.";
      if (!ticket.capacidade) e.capacidade = "Informe a quantidade.";
      if (!ticket.vendaInicio) e.vendaInicio = "Informe o início das vendas.";
      if (!ticket.vendaFim) e.vendaFim = "Informe o fim das vendas.";
      if (Object.keys(e).length > 0) ticketErros[ticket.id] = e;
    }
    if (Object.keys(ticketErros).length > 0) novosErros.tickets = ticketErros;

    return novosErros;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const novosErros = validar();
    setErros(novosErros);
    setSucesso(false);

    if (Object.keys(novosErros).length !== 0 || !usuario) return;

    const dadosEvento: DadosEvento = {
      titulo: nome,
      categoria: categoria || "outro",
      assunto,
      descricaoCompleta: descricao,
      modalidade,
      cidade: modalidade === "presencial" ? cidade : "Online",
      endereco:
        modalidade === "presencial"
          ? { rua, numero, bairro, cidade, estado }
          : undefined,
      linkAcesso: modalidade === "online" ? linkAcesso : undefined,
      dataInicio,
      dataFim,
      gradiente: eventoInicial?.gradiente ?? "from-zinc-700 via-zinc-600 to-zinc-500",
      tmdbId,
      posterUrl,
      usaMapaAssentos,
      status,
      ingressos: tickets.map((t) => ({
        nome: t.nome,
        gratuito: t.gratuito,
        preco: parseFloat(t.preco) || 0,
        capacidade: t.capacidade,
        vendaInicio: t.vendaInicio ?? undefined,
        vendaFim: t.vendaFim ?? undefined,
        publico: t.publico,
        descricao: t.descricao,
      })),
    };

    setEnviando(true);
    try {
      if (modo === "criar") {
        const criado = await criarEvento(dadosEvento);
        setSucesso(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        router.push(`/eventos/${criado.id}`);
      } else if (eventoInicial) {
        await atualizarEvento(eventoInicial.id, dadosEvento);
        router.push("/meus-eventos");
      }
    } catch (err) {
      setErros((prev) => ({
        ...prev,
        geral:
          err instanceof ApiError
            ? err.message
            : "Não foi possível salvar o evento. Tente novamente.",
      }));
    } finally {
      setEnviando(false);
    }
  };

  const handleExcluir = async () => {
    if (!eventoInicial) return;
    setExcluindo(true);
    try {
      await excluirEvento(eventoInicial.id);
      router.push("/meus-eventos");
    } catch (err) {
      setConfirmandoExclusao(false);
      setErros((prev) => ({
        ...prev,
        geral:
          err instanceof ApiError
            ? err.message
            : "Não foi possível excluir o evento. Tente novamente.",
      }));
    } finally {
      setExcluindo(false);
    }
  };

  const titulo = modo === "criar" ? "Criar evento" : "Editar evento";
  const subtitulo =
    modo === "criar"
      ? "Preencha as informações abaixo para publicar seu evento."
      : "Atualize as informações do seu evento.";
  const mensagemSucesso =
    modo === "criar" ? "Evento criado com sucesso!" : "Alterações salvas com sucesso!";
  const textoBotao = modo === "criar" ? "Criar evento" : "Salvar alterações";

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          {titulo}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {subtitulo}
        </p>

        {sucesso && (
          <div className="mt-6 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            {mensagemSucesso}
          </div>
        )}

        {erros.geral && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {erros.geral}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
          <FormSection title="Informações básicas">
            <FormField label="Status do evento">
              <SegmentedControl
                value={status}
                onChange={setStatus}
                options={[
                  { value: "publicado", label: "Publicado" },
                  { value: "rascunho", label: "Rascunho" },
                ]}
              />
            </FormField>

            <FormField label="Nome do evento" required error={erros.nome}>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Festival de Inverno"
                className={inputClass}
              />
            </FormField>

            <FormField label="Imagem do evento">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImagem(e.target.files?.[0])}
                className="text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white dark:text-zinc-400 dark:file:bg-zinc-50 dark:file:text-zinc-900"
              />
              {(imagemPreview || posterUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagemPreview ?? posterUrl}
                  alt="Pré-visualização da imagem do evento"
                  className="mt-2 h-40 w-full rounded-lg object-cover"
                />
              )}
            </FormField>

            <FormField label="Assunto" required error={erros.assunto}>
              <input
                type="text"
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Ex: Música e cultura"
                className={inputClass}
              />
            </FormField>

            <FormField label="Categoria">
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className={inputClass}
              >
                <option value="">Selecione uma categoria</option>
                <option value="show">Show</option>
                <option value="teatro">Teatro</option>
                <option value="cinema">Cinema</option>
                <option value="esporte">Esporte</option>
                <option value="workshop">Workshop</option>
                <option value="festa">Festa</option>
                <option value="gastronomia">Gastronomia</option>
                <option value="outro">Outro</option>
              </select>
            </FormField>

            {categoria === "cinema" && (
              <BuscaFilmeTmdb
                onSelecionar={(filme) => {
                  setNome(filme.titulo);
                  setDescricao(filme.sinopse);
                  setTmdbId(filme.tmdbId);
                  setPosterUrl(filme.posterUrl ?? undefined);
                }}
              />
            )}

            <FormField label="Descrição" required error={erros.descricao}>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Conte mais sobre o evento"
                rows={4}
                className={inputClass}
              />
            </FormField>
          </FormSection>

          <FormSection title="Data e local">
            <FormField label="Modalidade">
              <SegmentedControl
                value={modalidade}
                onChange={setModalidade}
                options={[
                  { value: "presencial", label: "Presencial" },
                  { value: "online", label: "Online" },
                ]}
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Início do evento"
                required
                error={erros.dataInicio}
              >
                <input
                  type="datetime-local"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className={dateInputClass}
                />
              </FormField>
              <FormField label="Fim do evento" required error={erros.dataFim}>
                <input
                  type="datetime-local"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className={dateInputClass}
                />
              </FormField>
            </div>

            {modalidade === "presencial" ? (
              <>
                <FormField label="CEP">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    className={`${inputClass} sm:max-w-50`}
                  />
                </FormField>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <FormField label="Endereço" required error={erros.rua}>
                      <input
                        type="text"
                        value={rua}
                        onChange={(e) => setRua(e.target.value)}
                        placeholder="Rua, avenida..."
                        className={inputClass}
                      />
                    </FormField>
                  </div>
                  <FormField label="Número">
                    <input
                      type="text"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="Nº"
                      className={inputClass}
                    />
                  </FormField>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField label="Bairro" required error={erros.bairro}>
                    <input
                      type="text"
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                      placeholder="Ex: Centro"
                      className={inputClass}
                    />
                  </FormField>
                  <FormField label="Cidade" required error={erros.cidade}>
                    <input
                      type="text"
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      placeholder="Ex: São Paulo"
                      className={inputClass}
                    />
                  </FormField>
                  <FormField label="Estado" required error={erros.estado}>
                    <input
                      type="text"
                      value={estado}
                      onChange={(e) => setEstado(e.target.value)}
                      placeholder="Ex: SP"
                      className={inputClass}
                    />
                  </FormField>
                </div>
              </>
            ) : (
              <FormField label="Link de acesso">
                <input
                  type="url"
                  value={linkAcesso}
                  onChange={(e) => setLinkAcesso(e.target.value)}
                  placeholder="https://..."
                  className={inputClass}
                />
              </FormField>
            )}
          </FormSection>

          <FormSection
            title="Ingressos"
            description="Adicione um ou mais tipos de ingresso para o evento."
          >
            <Toggle
              checked={usaMapaAssentos}
              onChange={setUsaMapaAssentos}
              label="Este evento usa mapa de assentos (o cliente escolhe o lugar ao comprar)"
            />

            <div className="flex flex-col gap-4">
              {tickets.map((ticket, index) => (
                <TicketTypeCard
                  key={ticket.id}
                  ticket={ticket}
                  index={index}
                  onChange={atualizarTicket}
                  onRemove={() => removerTicket(ticket.id)}
                  removable={tickets.length > 1}
                  errors={erros.tickets?.[ticket.id] ?? {}}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setTickets((prev) => [...prev, novoTicketType()])}
              className="self-start rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              + Adicionar tipo de ingresso
            </button>
          </FormSection>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={enviando}
              title={erros.geral}
              className="self-start rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {enviando ? "Salvando…" : textoBotao}
            </button>

            {modo === "editar" && (
              <button
                type="button"
                onClick={() => setConfirmandoExclusao(true)}
                className="self-start rounded-full border border-red-300 px-6 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                Excluir evento
              </button>
            )}
          </div>
        </form>
      </main>

      {confirmandoExclusao && (
        <ConfirmModal
          title="Excluir evento"
          description={
            'Esta ação remove o evento permanentemente e não pode ser desfeita. Se já houver ingressos vendidos, a exclusão será bloqueada — use o status "Rascunho" para tirá-lo de circulação sem apagar.'
          }
          confirmLabel={excluindo ? "Excluindo…" : "Excluir permanentemente"}
          onConfirm={handleExcluir}
          onCancel={() => setConfirmandoExclusao(false)}
        />
      )}
    </div>
  );
}
