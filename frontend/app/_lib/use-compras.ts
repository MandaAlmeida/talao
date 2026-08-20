import { useSyncExternalStore } from "react";
import {
  getComprasSalvasServerSnapshot,
  getComprasSalvasSnapshot,
  subscribeCompras,
} from "./compras-store";

export function useCompras() {
  return useSyncExternalStore(
    subscribeCompras,
    getComprasSalvasSnapshot,
    getComprasSalvasServerSnapshot,
  );
}
