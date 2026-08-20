"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { logout, papelLabel } from "../_lib/auth-store";
import { useUsuario } from "../_lib/use-auth";

const linksPublicos = [{ href: "/", label: "Início" }];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const usuario = useUsuario();
  const [menuAberto, setMenuAberto] = useState(false);

  const links = linksPublicos;

  const handleLogout = () => {
    logout();
    setMenuAberto(false);
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Talão
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  isActive
                    ? "text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          {usuario ? (
            <>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {usuario.nome}{" "}
                <span className="text-zinc-400 dark:text-zinc-500">
                  · {papelLabel[usuario.papel]}
                </span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Entrar
              </Link>
              <Link
                href="/registro"
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Criar conta
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuAberto((v) => !v)}
          aria-label="Abrir menu"
          aria-expanded={menuAberto}
          className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-900 md:hidden dark:text-zinc-50"
        >
          {menuAberto ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {menuAberto && (
        <nav className="flex flex-col gap-1 border-t border-zinc-200 bg-white px-4 py-3 md:hidden dark:border-zinc-800 dark:bg-black">
          {links.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuAberto(false)}
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  isActive
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="mt-2 flex flex-col gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
            {usuario ? (
              <>
                <span className="px-3 text-sm text-zinc-500 dark:text-zinc-400">
                  {usuario.nome} · {papelLabel[usuario.papel]}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-zinc-300 px-3 py-2 text-center text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMenuAberto(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400"
                >
                  Entrar
                </Link>
                <Link
                  href="/registro"
                  onClick={() => setMenuAberto(false)}
                  className="rounded-full bg-zinc-900 px-3 py-2 text-center text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900"
                >
                  Criar conta
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
