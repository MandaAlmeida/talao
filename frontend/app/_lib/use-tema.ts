import { useSyncExternalStore } from "react";
import { getTemaServerSnapshot, getTemaSnapshot, subscribeTema } from "./theme-store";

export function useTema() {
  return useSyncExternalStore(subscribeTema, getTemaSnapshot, getTemaServerSnapshot);
}
