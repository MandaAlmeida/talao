import { useEffect, useState, useSyncExternalStore } from "react";
import {
  buscarEventoPorId,
  carregarEventos,
  carregarMeusEventos,
  getEventosServerSnapshot,
  getEventosSnapshot,
  getMeusEventosServerSnapshot,
  getMeusEventosSnapshot,
  subscribeEventos,
  subscribeMeusEventos,
} from "./eventos-store";
import type { Evento } from "./eventos";
import { ApiError } from "./api-client";

export function useEventos() {
  const eventos = useSyncExternalStore(
    subscribeEventos,
    getEventosSnapshot,
    getEventosServerSnapshot,
  );

  useEffect(() => {
    carregarEventos().catch(() => {
      // erro tratado via estado de carregamento nos componentes que precisam de feedback
    });
  }, []);

  return eventos;
}

export function useMeusEventos() {
  const eventos = useSyncExternalStore(
    subscribeMeusEventos,
    getMeusEventosSnapshot,
    getMeusEventosServerSnapshot,
  );

  useEffect(() => {
    carregarMeusEventos().catch(() => {
      // erro tratado via estado de carregamento nos componentes que precisam de feedback
    });
  }, []);

  return eventos;
}

type EstadoEvento =
  | { status: "carregando"; id: string }
  | { status: "sucesso"; id: string; evento: Evento }
  | { status: "erro"; id: string; mensagem: string };

export function useEvento(id: string) {
  const [estado, setEstado] = useState<EstadoEvento>({ status: "carregando", id });

  useEffect(() => {
    let cancelado = false;

    buscarEventoPorId(id)
      .then((resultado) => {
        if (!cancelado) setEstado({ status: "sucesso", id, evento: resultado });
      })
      .catch((err) => {
        if (cancelado) return;
        setEstado({
          status: "erro",
          id,
          mensagem: err instanceof ApiError ? err.message : "Não foi possível carregar o evento.",
        });
      });

    return () => {
      cancelado = true;
    };
  }, [id]);

  const carregando = estado.status === "carregando" || estado.id !== id;

  return {
    evento: estado.status === "sucesso" && estado.id === id ? estado.evento : null,
    carregando,
    erro: estado.status === "erro" && estado.id === id ? estado.mensagem : null,
  };
}
