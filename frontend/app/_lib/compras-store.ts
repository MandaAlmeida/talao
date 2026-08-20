import {
  ingressosComprados as comprasIniciais,
  type IngressoComprado,
  type StatusCompra,
} from "./ingressos-comprados";

const STORAGE_KEY = "talao:compras";
const listeners = new Set<() => void>();

let ultimoRaw: string | null = null;
let ultimasCompras: IngressoComprado[] = comprasIniciais;

function lerStorage(): IngressoComprado[] {
  if (typeof window === "undefined") return comprasIniciais;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === ultimoRaw) return ultimasCompras;

  ultimoRaw = raw;
  if (!raw) {
    ultimasCompras = comprasIniciais;
    return ultimasCompras;
  }

  try {
    ultimasCompras = JSON.parse(raw) as IngressoComprado[];
  } catch {
    ultimasCompras = comprasIniciais;
  }
  return ultimasCompras;
}

function salvarStorage(compras: IngressoComprado[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(compras));
  listeners.forEach((listener) => listener());
}

export function subscribeCompras(listener: () => void) {
  listeners.add(listener);

  const onStorageEvent = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorageEvent);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorageEvent);
  };
}

export function getComprasSalvasSnapshot(): IngressoComprado[] {
  return lerStorage();
}

export function getComprasSalvasServerSnapshot(): IngressoComprado[] {
  return comprasIniciais;
}

export function gerarCodigoCompra(): string {
  return `TLO-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export function adicionarCompra(
  compra: Omit<IngressoComprado, "id" | "codigoCompra">,
): IngressoComprado {
  const novaCompra: IngressoComprado = {
    ...compra,
    id: crypto.randomUUID(),
    codigoCompra: gerarCodigoCompra(),
  };
  const compras = lerStorage();
  salvarStorage([...compras, novaCompra]);
  return novaCompra;
}

export function atualizarStatusCompra(id: string, status: StatusCompra) {
  const compras = lerStorage().map((c) =>
    c.id === id ? { ...c, status } : c,
  );
  salvarStorage(compras);
  return compras;
}

const STATUS_OCUPA_ESTOQUE: StatusCompra[] = ["confirmado", "usado"];

export function getAssentosOcupados(eventoId: string): string[] {
  return lerStorage()
    .filter(
      (c) => c.eventoId === eventoId && STATUS_OCUPA_ESTOQUE.includes(c.status),
    )
    .flatMap((c) => c.assentos ?? []);
}

export function getQuantidadeVendida(ticketId: string): number {
  return lerStorage()
    .filter(
      (c) => c.ticketId === ticketId && STATUS_OCUPA_ESTOQUE.includes(c.status),
    )
    .reduce((total, c) => total + c.quantidade, 0);
}
