import type { StatusEvento } from "../_lib/eventos";

const config: Record<StatusEvento, { label: string; classes: string; dot: string }> = {
  publicado: {
    label: "Publicado",
    classes: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
    dot: "bg-green-500",
  },
  "em-breve": {
    label: "Em breve",
    classes: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  "pre-venda": {
    label: "Pré-venda",
    classes: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  rascunho: {
    label: "Rascunho",
    classes: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    dot: "bg-zinc-400",
  },
};

export default function StatusBadge({ status }: { status: StatusEvento }) {
  const { label, classes, dot } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
