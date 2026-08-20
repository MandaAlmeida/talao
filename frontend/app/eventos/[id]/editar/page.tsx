"use client";

import { notFound, useParams } from "next/navigation";
import EventForm from "../../../_components/form/EventForm";
import RequireRole from "../../../_components/RequireRole";
import { useEvento } from "../../../_lib/use-eventos";
import { useUsuario } from "../../../_lib/use-auth";

function ConteudoEditarEvento() {
  const params = useParams<{ id: string }>();
  const { evento, carregando, erro } = useEvento(params.id);
  const usuario = useUsuario();

  if (erro) notFound();
  if (carregando || !evento) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Carregando evento…</p>
      </div>
    );
  }
  if (evento.organizadorId !== usuario?.id) notFound();

  return <EventForm modo="editar" eventoInicial={evento} />;
}

export default function EditarEventoPage() {
  return (
    <RequireRole papel="organizador">
      <ConteudoEditarEvento />
    </RequireRole>
  );
}
