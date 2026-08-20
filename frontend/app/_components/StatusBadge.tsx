import type { StatusEvento } from "../_lib/eventos";

export default function StatusBadge({ status }: { status: StatusEvento }) {
  const isPublicado = status === "publicado";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        isPublicado
          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isPublicado ? "bg-green-500" : "bg-zinc-400"
        }`}
      />
      {isPublicado ? "Publicado" : "Rascunho"}
    </span>
  );
}
