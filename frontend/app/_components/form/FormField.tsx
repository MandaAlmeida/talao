export default function FormField({
  label,
  required,
  htmlFor,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-gray-900 dark:text-zinc-50";

// O ícone nativo do seletor de data/hora (::-webkit-calendar-picker-indicator)
// é escuro por padrão e fica invisível sobre o fundo escuro do dark mode —
// inverte a cor do ícone só no dark mode para mantê-lo visível.
export const dateInputClass = `${inputClass} dark:[&::-webkit-calendar-picker-indicator]:invert`;
