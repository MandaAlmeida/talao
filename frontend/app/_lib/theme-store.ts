export type Tema = "light" | "dark";

const STORAGE_KEY = "talao:tema";
const listeners = new Set<() => void>();

function aplicarNoDocumento(tema: Tema) {
  document.documentElement.classList.toggle("dark", tema === "dark");
}

function lerTemaSalvo(): Tema | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "light" || raw === "dark" ? raw : null;
}

function temaPreferidoDoSistema(): Tema {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function subscribeTema(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTemaSnapshot(): Tema {
  if (typeof window === "undefined") return "light";
  return lerTemaSalvo() ?? temaPreferidoDoSistema();
}

export function getTemaServerSnapshot(): Tema {
  return "light";
}

export function setTema(tema: Tema) {
  window.localStorage.setItem(STORAGE_KEY, tema);
  aplicarNoDocumento(tema);
  listeners.forEach((listener) => listener());
}

export function alternarTema() {
  setTema(getTemaSnapshot() === "dark" ? "light" : "dark");
}

// Executado inline no <head>, antes da hidratação, para não piscar o tema errado.
export const SCRIPT_TEMA_INICIAL = `
(function () {
  try {
    var tema = localStorage.getItem("${STORAGE_KEY}");
    if (tema !== "light" && tema !== "dark") {
      tema = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    if (tema === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;
