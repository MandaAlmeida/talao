import { useSyncExternalStore } from "react";
import {
  getUsuarioServerSnapshot,
  getUsuarioSnapshot,
  subscribeUsuario,
} from "./auth-store";

export function useUsuario() {
  return useSyncExternalStore(
    subscribeUsuario,
    getUsuarioSnapshot,
    getUsuarioServerSnapshot,
  );
}
