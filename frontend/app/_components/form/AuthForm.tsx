"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ApiError } from "../../_lib/api-client";
import {
  login,
  papelLabel,
  registrar,
  type Papel,
} from "../../_lib/auth-store";
import FormField, { inputClass } from "./FormField";

const destinoPorPapel: Record<Papel, string> = {
  organizador: "/meus-eventos",
  cliente: "/",
  portaria: "/portaria",
};

// Só aceita caminhos internos (começando com "/", mas não "//" ou "/\",
// que navegadores tratam como protocol-relative para outro domínio) —
// evita que um ?next= malicioso mande o usuário pra fora do site.
function destinoSeguro(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

function AuthFormInterno({ modo }: { modo: "login" | "registro" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<Papel>("cliente");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const titulo = modo === "login" ? "Entrar" : "Criar conta";
  const textoBotao = modo === "login" ? "Entrar" : "Criar conta";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");

    if (modo === "registro" && !nome.trim()) {
      setErro("Informe seu nome.");
      return;
    }
    if (!email.trim()) {
      setErro("Informe seu e-mail.");
      return;
    }
    if (!senha) {
      setErro("Informe sua senha.");
      return;
    }

    setCarregando(true);
    try {
      const usuario =
        modo === "login"
          ? await login(email.trim(), senha)
          : await registrar(nome.trim(), email.trim(), senha, papel);
      const next = destinoSeguro(searchParams.get("next"));
      const papelEsperado = searchParams.get("papelEsperado");
      const destino =
        next && usuario.papel === papelEsperado
          ? next
          : destinoPorPapel[usuario.papel];
      router.push(destino);
    } catch (err) {
      setErro(
        err instanceof ApiError
          ? err.message
          : "Não foi possível conectar ao servidor. Tente novamente.",
      );
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-[#111111]">
      <div className="w-full max-w-sm px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          {titulo}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {modo === "login"
            ? "Entre com seu e-mail e senha."
            : "Crie sua conta escolhendo como vai usar o Talão."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {modo === "registro" && (
            <FormField label="Nome" required>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                autoFocus
                className={inputClass}
              />
            </FormField>
          )}

          <FormField label="E-mail" required>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoFocus={modo === "login"}
              className={inputClass}
            />
          </FormField>

          <FormField label="Senha" required error={erro || undefined}>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••"
              className={inputClass}
            />
          </FormField>

          {modo === "registro" && (
            <FormField label="Entrar como">
              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(papelLabel) as Papel[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPapel(p)}
                    className={`rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                      papel === p
                        ? "border-zinc-900 bg-zinc-50 text-zinc-900 dark:border-zinc-50 dark:bg-zinc-800 dark:text-zinc-50"
                        : "border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400"
                    }`}
                  >
                    {papelLabel[p]}
                  </button>
                ))}
              </div>
            </FormField>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="mt-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {carregando ? "Aguarde…" : textoBotao}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AuthForm(props: { modo: "login" | "registro" }) {
  return (
    <Suspense fallback={null}>
      <AuthFormInterno {...props} />
    </Suspense>
  );
}
