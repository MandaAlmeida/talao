import type { Sessao, TicketType } from "../../_lib/eventos";
import { novoTicketType } from "../../_lib/eventos";
import FormField, { dateInputClass, inputClass } from "./FormField";
import TicketTypeCard from "./TicketTypeCard";

export type SessaoErros = {
  dataHora?: string;
  tickets?: Record<string, Partial<Record<keyof TicketType, string>>>;
};

export default function SessaoCard({
  sessao,
  index,
  onChange,
  onRemove,
  removable,
  errors,
}: {
  sessao: Sessao;
  index: number;
  onChange: (sessao: Sessao) => void;
  onRemove: () => void;
  removable: boolean;
  errors: SessaoErros;
}) {
  const set = <K extends keyof Sessao>(key: K, value: Sessao[K]) =>
    onChange({ ...sessao, [key]: value });

  const atualizarTicket = (ticket: TicketType) => {
    onChange({
      ...sessao,
      ingressos: sessao.ingressos.map((t) => (t.id === ticket.id ? ticket : t)),
    });
  };

  const removerTicket = (id: string) => {
    onChange({ ...sessao, ingressos: sessao.ingressos.filter((t) => t.id !== id) });
  };

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Sessão {index + 1}
        </span>
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-medium text-red-500 hover:underline"
          >
            Remover
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Data e hora" required error={errors.dataHora}>
            <input
              type="datetime-local"
              value={sessao.dataHora}
              onChange={(e) => set("dataHora", e.target.value)}
              className={dateInputClass}
            />
          </FormField>
          <FormField label="Sala (opcional)">
            <input
              type="text"
              value={sessao.sala ?? ""}
              onChange={(e) => set("sala", e.target.value || null)}
              placeholder="Ex: Sala 1"
              className={inputClass}
            />
          </FormField>
        </div>

        <div className="flex flex-col gap-4">
          {sessao.ingressos.map((ticket, ticketIndex) => (
            <TicketTypeCard
              key={ticket.id}
              ticket={ticket}
              index={ticketIndex}
              onChange={atualizarTicket}
              onRemove={() => removerTicket(ticket.id)}
              removable={sessao.ingressos.length > 1}
              errors={errors.tickets?.[ticket.id] ?? {}}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            onChange({ ...sessao, ingressos: [...sessao.ingressos, novoTicketType()] })
          }
          className="self-start rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          + Adicionar tipo de ingresso
        </button>
      </div>
    </div>
  );
}
