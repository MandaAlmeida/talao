"use client";

const FILEIRAS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const ASSENTOS_POR_FILEIRA = 10;

export default function SeatMap({
  selecionados,
  ocupados,
  onToggle,
}: {
  selecionados: string[];
  ocupados: string[];
  onToggle: (assento: string) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="mb-2 h-2 w-3/4 rounded-full bg-zinc-300 dark:bg-zinc-700" />
      <span className="-mt-3 text-xs text-zinc-400">Palco</span>

      <div className="flex flex-col gap-1.5">
        {FILEIRAS.map((fileira) => (
          <div key={fileira} className="flex items-center gap-1.5">
            <span className="w-4 text-xs text-zinc-400">{fileira}</span>
            {Array.from({ length: ASSENTOS_POR_FILEIRA }, (_, i) => {
              const numero = i + 1;
              const codigo = `${fileira}${numero}`;
              const ocupado = ocupados.includes(codigo);
              const selecionado = selecionados.includes(codigo);

              return (
                <button
                  key={codigo}
                  type="button"
                  disabled={ocupado}
                  onClick={() => onToggle(codigo)}
                  aria-label={`Assento ${codigo}${ocupado ? " (ocupado)" : ""}`}
                  className={`h-6 w-6 rounded text-[10px] font-medium transition-colors ${
                    ocupado
                      ? "cursor-not-allowed bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
                      : selecionado
                        ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                  }`}
                >
                  {numero}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-zinc-100 dark:bg-zinc-700" />
          Disponível
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-zinc-900 dark:bg-zinc-50" />
          Selecionado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-zinc-200 dark:bg-zinc-800" />
          Ocupado
        </span>
      </div>
    </div>
  );
}
