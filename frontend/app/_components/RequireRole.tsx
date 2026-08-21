"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import type { Papel } from "../_lib/auth-store";
import { useUsuario } from "../_lib/use-auth";
import { useHidratado } from "../_lib/use-hidratado";

function RequireRoleInterno({
  papel,
  children,
}: {
  papel: Papel;
  children: React.ReactNode;
}) {
  const usuario = useUsuario();
  const router = useRouter();
  const hidratado = useHidratado();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const autorizado = usuario !== null && usuario.papel === papel;

  useEffect(() => {
    if (!hidratado || autorizado) return;
    const query = searchParams.toString();
    const urlAtual = query ? `${pathname}?${query}` : pathname;
    router.replace(
      `/login?next=${encodeURIComponent(urlAtual)}&papelEsperado=${papel}`,
    );
  }, [hidratado, autorizado, router, pathname, searchParams, papel]);

  if (!hidratado || !autorizado) return null;

  return <>{children}</>;
}

export default function RequireRole(props: {
  papel: Papel;
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <RequireRoleInterno {...props} />
    </Suspense>
  );
}
