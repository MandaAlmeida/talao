import { assinarCodigo, gerarCodigoCompra, verificarAssinatura } from './qr.util';

describe('qr.util', () => {
  const secret = 'test-secret';

  it('generates a codigoCompra in the TLO-XXXXXX format', () => {
    const codigo = gerarCodigoCompra();
    expect(codigo).toMatch(/^TLO-[A-F0-9]{6}$/);
  });

  it('verifies a signature produced by assinarCodigo', () => {
    const codigo = 'TLO-ABC123';
    const assinatura = assinarCodigo(codigo, secret);

    expect(verificarAssinatura(codigo, assinatura, secret)).toBe(true);
  });

  it('rejects a tampered code against an existing signature', () => {
    const assinatura = assinarCodigo('TLO-ABC123', secret);

    expect(verificarAssinatura('TLO-FORJADO', assinatura, secret)).toBe(false);
  });

  it('rejects a tampered signature against a valid code', () => {
    const codigo = 'TLO-ABC123';

    expect(verificarAssinatura(codigo, 'assinatura-forjada', secret)).toBe(false);
  });

  it('rejects a valid code/signature pair signed with a different secret', () => {
    const codigo = 'TLO-ABC123';
    const assinatura = assinarCodigo(codigo, 'outro-secret');

    expect(verificarAssinatura(codigo, assinatura, secret)).toBe(false);
  });
});
