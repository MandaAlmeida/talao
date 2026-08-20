"use client";

import { useEffect, useId, useRef, useState } from "react";

export type SelectOption<T extends string> = {
  value: T;
  label: string;
};

export default function Select<T extends string>({
  value,
  onChange,
  options,
  className = "",
}: {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  const listaId = useId();

  const indiceSelecionado = options.findIndex((o) => o.value === value);
  const opcaoSelecionada = options[indiceSelecionado];

  const abrir = () => {
    setIndiceAtivo(indiceSelecionado === -1 ? 0 : indiceSelecionado);
    setAberto(true);
  };

  useEffect(() => {
    if (!aberto) return;

    const handleClickFora = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const item = listaRef.current?.children[indiceAtivo] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [aberto, indiceAtivo]);

  const selecionar = (opcao: SelectOption<T>) => {
    onChange(opcao.value);
    setAberto(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!aberto) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        abrir();
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setAberto(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceAtivo((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opcao = options[indiceAtivo];
      if (opcao) selecionar(opcao);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-expanded={aberto}
        aria-haspopup="listbox"
        aria-controls={listaId}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        onKeyDown={handleKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-left text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
      >
        <span className="truncate">{opcaoSelecionada?.label ?? ""}</span>
        <ChevronIcon aberto={aberto} />
      </button>

      {aberto && (
        <ul
          ref={listaRef}
          id={listaId}
          role="listbox"
          className="absolute z-20 mt-1.5 max-h-60 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {options.map((opcao, i) => (
            <li key={opcao.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={opcao.value === value}
                onClick={() => selecionar(opcao)}
                onMouseEnter={() => setIndiceAtivo(i)}
                className={`w-full px-3.5 py-2 text-left text-sm transition-colors ${
                  i === indiceAtivo
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-700 dark:text-zinc-300"
                } ${opcao.value === value ? "font-semibold" : ""}`}
              >
                {opcao.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChevronIcon({ aberto }: { aberto: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${aberto ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
