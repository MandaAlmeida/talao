import { apiFetch } from "./api-client";

export type Papel = "organizador" | "cliente" | "portaria";

export const CLIENTE_DEMO_ID = "cliente-demo";

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
};

type RoleBackend = "ORGANIZADOR" | "CLIENTE" | "PORTARIA";

type SessaoResponse = {
  accessToken: string;
  usuario: {
    id: string;
    nome: string;
    email: string;
    papel: RoleBackend;
  };
};

type Sessao = {
  accessToken: string;
  usuario: Usuario;
};

const STORAGE_KEY = "talao:usuario";
const listeners = new Set<() => void>();

let ultimoRaw: string | null = null;
let ultimoUsuario: Usuario | null = null;

function papelParaFrontend(papel: RoleBackend): Papel {
  return papel.toLowerCase() as Papel;
}

function papelParaBackend(papel: Papel): RoleBackend {
  return papel.toUpperCase() as RoleBackend;
}

function lerStorage(): Sessao | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Sessao;
  } catch {
    return null;
  }
}

function salvarSessao(resposta: SessaoResponse): Usuario {
  const usuario: Usuario = {
    id: resposta.usuario.id,
    nome: resposta.usuario.nome,
    email: resposta.usuario.email,
    papel: papelParaFrontend(resposta.usuario.papel),
  };
  const sessao: Sessao = { accessToken: resposta.accessToken, usuario };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessao));
  listeners.forEach((listener) => listener());
  return usuario;
}

export function subscribeUsuario(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUsuarioSnapshot(): Usuario | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === ultimoRaw) return ultimoUsuario;

  ultimoRaw = raw;
  ultimoUsuario = lerStorage()?.usuario ?? null;
  return ultimoUsuario;
}

export function getUsuarioServerSnapshot(): Usuario | null {
  return null;
}

export async function login(email: string, senha: string): Promise<Usuario> {
  const resposta = await apiFetch<SessaoResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ email, senha }),
  });
  return salvarSessao(resposta);
}

export async function registrar(
  nome: string,
  email: string,
  senha: string,
  papel: Papel,
): Promise<Usuario> {
  const resposta = await apiFetch<SessaoResponse>("/auth/registro", {
    method: "POST",
    auth: false,
    body: JSON.stringify({
      nome,
      email,
      senha,
      papel: papelParaBackend(papel),
    }),
  });
  return salvarSessao(resposta);
}

export function logout() {
  window.localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((listener) => listener());
}

export const papelLabel: Record<Papel, string> = {
  organizador: "Organizador",
  cliente: "Cliente",
  portaria: "Portaria",
};
