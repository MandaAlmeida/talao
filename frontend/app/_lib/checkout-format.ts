export function formatarNumeroCartao(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 16);
  return digitos.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function formatarValidadeCartao(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 4);
  if (digitos.length <= 2) return digitos;
  return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
}

export function formatarCvv(valor: string): string {
  return valor.replace(/\D/g, "").slice(0, 4);
}

export function formatarCpf(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  return digitos
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function formatarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 10) {
    return digitos
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digitos
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function formatarCep(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 8);
  return digitos.replace(/(\d{5})(\d)/, "$1-$2");
}

export function cpfValido(cpf: string): boolean {
  return cpf.replace(/\D/g, "").length === 11;
}

export function telefoneValido(telefone: string): boolean {
  const digitos = telefone.replace(/\D/g, "").length;
  return digitos === 10 || digitos === 11;
}

export function cepValido(cep: string): boolean {
  return cep.replace(/\D/g, "").length === 8;
}

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export type Bandeira =
  | "Visa"
  | "Mastercard"
  | "Elo"
  | "American Express"
  | null;

const PREFIXOS_ELO = [
  "4011",
  "4312",
  "4389",
  "4514",
  "4573",
  "6277",
  "6362",
  "6363",
  "6504",
  "6505",
  "6506",
  "6507",
  "6509",
  "6516",
  "6550",
];

export function detectarBandeira(numeroCartao: string): Bandeira {
  const digitos = numeroCartao.replace(/\D/g, "");
  if (!digitos) return null;

  if (PREFIXOS_ELO.some((prefixo) => digitos.startsWith(prefixo))) return "Elo";
  if (/^4/.test(digitos)) return "Visa";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digitos)) return "Mastercard";
  if (/^3[47]/.test(digitos)) return "American Express";

  return null;
}
