"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Papel } from "../_lib/auth-store";
import { useUsuario } from "../_lib/use-auth";
import { useHidratado } from "../_lib/use-hidratado";

export default function RequireRole({
  papel,
  children,
}: {
  papel: Papel;
  children: React.ReactNode;
}) {
  const usuario = useUsuario();
  const router = useRouter();
  const hidratado = useHidratado();

  const autorizado = usuario !== null && usuario.papel === papel;

  useEffect(() => {
    if (hidratado && !autorizado) router.replace("/login");
  }, [hidratado, autorizado, router]);

  if (!hidratado || !autorizado) return null;

  return <>{children}</>;
}
