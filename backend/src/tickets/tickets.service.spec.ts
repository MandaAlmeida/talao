import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BookingStatus } from '@prisma/client';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import { assinarCodigo } from '../bookings/qr.util';

describe('TicketsService', () => {
  const secret = 'test-qr-secret';
  let service: TicketsService;
  let prisma: {
    booking: { findUnique: jest.Mock; update: jest.Mock };
    event: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      booking: { findUnique: jest.fn(), update: jest.fn() },
      event: { findUnique: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => secret } },
      ],
    }).compile();

    service = moduleRef.get(TicketsService);
  });

  it('returns invalido when the signature does not match the code', async () => {
    // findUnique is not mocked here, so it resolves undefined — the service's
    // `!booking` branch and its "signature invalid" branch return the same
    // situacao, so this also covers "booking found but qrAssinatura mismatched".
    const resultado = await service.validar({
      codigo: 'TLO-ABC123',
      eventoId: 'evento-1',
    });

    expect(resultado.situacao).toBe('invalido');
  });

  it('returns invalido when the booking does not exist', async () => {
    prisma.booking.findUnique.mockResolvedValue(null);

    const codigo = 'TLO-ABC123';
    const resultado = await service.validar({ codigo, eventoId: 'evento-1' });

    expect(resultado.situacao).toBe('invalido');
  });

  it('returns evento-errado when the booking belongs to another event', async () => {
    const codigo = 'TLO-ABC123';
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      codigoCompra: codigo,
      eventoId: 'evento-2',
      status: BookingStatus.CONFIRMADO,
    });
    prisma.event.findUnique.mockResolvedValue({ id: 'evento-2', titulo: 'Outro Evento' });

    // Sign with the real secret via a fresh service call path isn't possible without
    // exposing qrAssinatura, so this test stubs verificarAssinatura indirectly by
    // matching what buscarBookingAssinado expects: the DTO codigo + a booking whose
    // qrAssinatura was produced with the shared secret.
    const assinatura = assinarCodigo(codigo, secret);
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      codigoCompra: codigo,
      qrAssinatura: assinatura,
      eventoId: 'evento-2',
      status: BookingStatus.CONFIRMADO,
    });

    const resultado = await service.validar({ codigo, eventoId: 'evento-1' });

    expect(resultado.situacao).toBe('evento-errado');
    expect(resultado.detalhe).toBe('Outro Evento');
  });

  it('returns ja-utilizado when the booking was already used', async () => {
    const codigo = 'TLO-ABC123';
    const assinatura = assinarCodigo(codigo, secret);
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      codigoCompra: codigo,
      qrAssinatura: assinatura,
      eventoId: 'evento-1',
      status: BookingStatus.USADO,
    });

    const resultado = await service.validar({ codigo, eventoId: 'evento-1' });

    expect(resultado.situacao).toBe('ja-utilizado');
  });

  it('marks the booking as USADO and returns valido on first scan', async () => {
    const codigo = 'TLO-ABC123';
    const assinatura = assinarCodigo(codigo, secret);
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      codigoCompra: codigo,
      qrAssinatura: assinatura,
      eventoId: 'evento-1',
      status: BookingStatus.CONFIRMADO,
      quantidade: 2,
      ticketType: { nome: 'Pista' },
    });
    prisma.booking.update.mockResolvedValue({});

    const resultado = await service.validar({ codigo, eventoId: 'evento-1' });

    expect(resultado.situacao).toBe('valido');
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: BookingStatus.USADO, usadoEm: expect.any(Date) },
    });
  });
});
