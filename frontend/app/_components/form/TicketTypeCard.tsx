import type { TicketType } from "../../_lib/eventos";
import FormField, { dateInputClass, inputClass } from "./FormField";
import SegmentedControl from "./SegmentedControl";

export default function TicketTypeCard({
  ticket,
  index,
  onChange,
  onRemove,
  removable,
  errors,
}: {
  ticket: TicketType;
  index: number;
  onChange: (ticket: TicketType) => void;
  onRemove: () => void;
  removable: boolean;
  errors: Partial<Record<keyof TicketType, string>>;
}) {
  const set = <K extends keyof TicketType>(key: K, value: TicketType[K]) =>
    onChange({ ...ticket, [key]: value });

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Ingresso {index + 1}
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
        <FormField label="Nome do ingresso" required error={errors.nome}>
          <input
            type="text"
            value={ticket.nome}
            onChange={(e) => set("nome", e.target.value)}
            placeholder="Ex: Pista, VIP, Meia-entrada"
            className={inputClass}
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Tipo">
            <SegmentedControl
              value={ticket.gratuito ? "gratuito" : "pago"}
              onChange={(v) => set("gratuito", v === "gratuito")}
              options={[
                { value: "pago", label: "Pago" },
                { value: "gratuito", label: "Gratuito" },
              ]}
            />
          </FormField>

          {!ticket.gratuito && (
            <FormField label="Preço (R$)" required error={errors.preco}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={ticket.preco}
                onChange={(e) => set("preco", e.target.value)}
                placeholder="0,00"
                className={inputClass}
              />
            </FormField>
          )}
        </div>

        <FormField
          label="Quantidade disponível"
          required
          error={errors.capacidade}
        >
          <input
            type="number"
            min="1"
            value={ticket.capacidade || ""}
            onChange={(e) => set("capacidade", parseInt(e.target.value, 10) || 0)}
            placeholder="Ex: 100"
            className={inputClass}
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Início das vendas" required error={errors.vendaInicio}>
            <input
              type="datetime-local"
              value={ticket.vendaInicio ?? ""}
              onChange={(e) => set("vendaInicio", e.target.value || null)}
              className={dateInputClass}
            />
          </FormField>
          <FormField label="Fim das vendas" required error={errors.vendaFim}>
            <input
              type="datetime-local"
              value={ticket.vendaFim ?? ""}
              onChange={(e) => set("vendaFim", e.target.value || null)}
              className={dateInputClass}
            />
          </FormField>
        </div>

        <FormField label="Quem pode comprar">
          <select
            value={ticket.publico}
            onChange={(e) =>
              set("publico", e.target.value as TicketType["publico"])
            }
            className={inputClass}
          >
            <option value="geral">Público geral</option>
            <option value="restrito">Somente com link ou senha</option>
          </select>
        </FormField>

        <FormField label="Descrição">
          <textarea
            value={ticket.descricao}
            onChange={(e) => set("descricao", e.target.value)}
            placeholder="Detalhes sobre este tipo de ingresso"
            rows={2}
            className={inputClass}
          />
        </FormField>
      </div>
    </div>
  );
}
