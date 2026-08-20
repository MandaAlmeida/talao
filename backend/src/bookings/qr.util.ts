import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

export function gerarCodigoCompra(): string {
  return `TLO-${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

export function assinarCodigo(codigo: string, secret: string): string {
  return createHmac('sha256', secret).update(codigo).digest('hex');
}

export function verificarAssinatura(
  codigo: string,
  assinatura: string,
  secret: string,
): boolean {
  const esperada = assinarCodigo(codigo, secret);
  const bufEsperada = Buffer.from(esperada, 'hex');
  const bufRecebida = Buffer.from(assinatura, 'hex');

  if (bufEsperada.length !== bufRecebida.length) return false;
  return timingSafeEqual(bufEsperada, bufRecebida);
}
