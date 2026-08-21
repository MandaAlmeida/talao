import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, EventStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../payments/stripe.service';

describe('BookingsService (unit, mocked Prisma)', () => {
  let service: BookingsService;
  let prisma: {
    $transaction: jest.Mock;
    booking: { update: jest.Mock; findUnique: jest.Mock };
    seat: { updateMany: jest.Mock };
    order: { findUnique: jest.Mock };
    sessao: { findUnique: jest.Mock };
  };
  let tx: {
    ticketType: { findUnique: jest.Mock; findMany: jest.Mock };
    seat: { findMany: jest.Mock; updateMany: jest.Mock };
    booking: { aggregate: jest.Mock; create: jest.Mock };
  };
  let stripeMock: { criarPaymentIntent: jest.Mock; criarReembolso: jest.Mock };

  const amanha = new Date(Date.now() + 24 * 60 * 60_000);
  const ontem = new Date(Date.now() - 24 * 60 * 60_000);

  beforeEach(async () => {
    tx = {
      ticketType: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      seat: { findMany: jest.fn(), updateMany: jest.fn() },
      booking: { aggregate: jest.fn(), create: jest.fn() },
    };
    prisma = {
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => unknown)(tx)
          : Promise.all(arg as unknown[]),
      ),
      booking: {
        update: jest
          .fn()
          .mockResolvedValue({ id: 'booking-1', expiraEm: new Date() }),
        findUnique: jest.fn(),
      },
      seat: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      order: { findUnique: jest.fn() },
      sessao: { findUnique: jest.fn() },
    };
    stripeMock = {
      criarPaymentIntent: jest
        .fn()
        .mockResolvedValue({ id: 'pi_test', clientSecret: 'secret_test' }),
      criarReembolso: jest
        .fn()
        .mockResolvedValue({ id: 're_test', status: 'succeeded' }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => 'test-qr-secret' } },
        { provide: StripeService, useValue: stripeMock },
      ],
    }).compile();

    service = moduleRef.get(BookingsService);
  });

  it('rejects reserving a ticket for an event that is RASCUNHO', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      capacidade: 10,
      preco: { toString: () => '20' },
      gratuito: false,
      sessao: {
        id: 'sessao-1',
        dataHora: amanha,
        evento: {
          id: 'evento-1',
          usaMapaAssentos: false,
          status: EventStatus.RASCUNHO,
        },
      },
    });

    await expect(
      service.reservar('cliente-1', 'sessao-1', {
        ticketTypeId: 'ticket-1',
        quantidade: 1,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects reserving a ticket for an event that is EM_BREVE', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      capacidade: 10,
      preco: { toString: () => '20' },
      gratuito: false,
      sessao: {
        id: 'sessao-1',
        dataHora: amanha,
        evento: {
          id: 'evento-1',
          usaMapaAssentos: false,
          status: EventStatus.EM_BREVE,
        },
      },
    });

    await expect(
      service.reservar('cliente-1', 'sessao-1', {
        ticketTypeId: 'ticket-1',
        quantidade: 1,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('allows reserving a ticket for an event that is PRE_VENDA', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      capacidade: 10,
      preco: { toString: () => '20' },
      gratuito: false,
      sessao: {
        id: 'sessao-1',
        dataHora: amanha,
        evento: {
          id: 'evento-1',
          usaMapaAssentos: false,
          status: EventStatus.PRE_VENDA,
        },
      },
    });
    tx.booking.aggregate.mockResolvedValue({ _sum: { quantidade: 0 } });
    tx.booking.create.mockResolvedValue({
      id: 'booking-1',
      status: 'PENDENTE',
      seats: [],
    });

    await expect(
      service.reservar('cliente-1', 'sessao-1', {
        ticketTypeId: 'ticket-1',
        quantidade: 1,
      }),
    ).resolves.toBeDefined();
  });

  it('rejects when quantity-based stock is insufficient', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      capacidade: 10,
      preco: { toString: () => '20' },
      gratuito: false,
      sessao: {
        id: 'sessao-1',
        dataHora: amanha,
        evento: {
          id: 'evento-1',
          usaMapaAssentos: false,
          status: EventStatus.PUBLICADO,
        },
      },
    });
    tx.booking.aggregate.mockResolvedValue({ _sum: { quantidade: 9 } });

    await expect(
      service.reservar('cliente-1', 'sessao-1', {
        ticketTypeId: 'ticket-1',
        quantidade: 2,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects reserving for a sessão that already started', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      capacidade: 10,
      preco: { toString: () => '20' },
      gratuito: false,
      sessao: {
        id: 'sessao-1',
        dataHora: ontem,
        evento: {
          id: 'evento-1',
          usaMapaAssentos: false,
          status: EventStatus.PUBLICADO,
        },
      },
    });

    await expect(
      service.reservar('cliente-1', 'sessao-1', {
        ticketTypeId: 'ticket-1',
        quantidade: 1,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects reserving a ticketType whose vendaInicio has not arrived yet', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      capacidade: 10,
      preco: { toString: () => '20' },
      gratuito: false,
      vendaInicio: new Date(Date.now() + 60_000),
      sessao: {
        id: 'sessao-1',
        dataHora: amanha,
        evento: {
          id: 'evento-1',
          usaMapaAssentos: false,
          status: EventStatus.PUBLICADO,
        },
      },
    });

    await expect(
      service.reservar('cliente-1', 'sessao-1', {
        ticketTypeId: 'ticket-1',
        quantidade: 1,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects reserving a ticketType whose vendaFim already passed', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      capacidade: 10,
      preco: { toString: () => '20' },
      gratuito: false,
      vendaFim: new Date(Date.now() - 60_000),
      sessao: {
        id: 'sessao-1',
        dataHora: amanha,
        evento: {
          id: 'evento-1',
          usaMapaAssentos: false,
          status: EventStatus.PUBLICADO,
        },
      },
    });

    await expect(
      service.reservar('cliente-1', 'sessao-1', {
        ticketTypeId: 'ticket-1',
        quantidade: 1,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when a requested seat is already taken', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      capacidade: 80,
      preco: { toString: () => '20' },
      gratuito: false,
      sessao: {
        id: 'sessao-1',
        dataHora: amanha,
        evento: {
          id: 'evento-1',
          usaMapaAssentos: true,
          status: EventStatus.PUBLICADO,
        },
      },
    });
    tx.seat.findMany.mockResolvedValue([
      { codigo: 'A1', bookingId: null },
      { codigo: 'A2', bookingId: 'booking-existing' },
    ]);

    await expect(
      service.reservar('cliente-1', 'sessao-1', {
        ticketTypeId: 'ticket-1',
        assentos: ['A1', 'A2'],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a seat outside the fileira permitted for the ticketType', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-vip',
      capacidade: 10,
      preco: { toString: () => '100' },
      gratuito: false,
      fileiraInicio: 'A',
      fileiraFim: 'A',
      sessao: {
        id: 'sessao-1',
        dataHora: amanha,
        evento: {
          id: 'evento-1',
          usaMapaAssentos: true,
          status: EventStatus.PUBLICADO,
        },
      },
    });
    tx.seat.findMany.mockResolvedValue([
      { codigo: 'B1', sessaoId: 'sessao-1', bookingId: null },
    ]);
    tx.ticketType.findMany.mockResolvedValue([
      { id: 'ticket-inteira', fileiraInicio: 'B', fileiraFim: 'H' },
    ]);

    await expect(
      service.reservar('cliente-1', 'sessao-1', {
        ticketTypeId: 'ticket-vip',
        assentos: ['B1'],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a seat-based booking with no assentos provided', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      capacidade: 80,
      preco: { toString: () => '20' },
      gratuito: false,
      sessao: {
        id: 'sessao-1',
        dataHora: amanha,
        evento: {
          id: 'evento-1',
          usaMapaAssentos: true,
          status: EventStatus.PUBLICADO,
        },
      },
    });

    await expect(
      service.reservar('cliente-1', 'sessao-1', { ticketTypeId: 'ticket-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates a PENDENTE booking and a Stripe PaymentIntent', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      capacidade: 100,
      preco: { toString: () => '50' },
      gratuito: false,
      sessao: {
        id: 'sessao-1',
        dataHora: amanha,
        evento: {
          id: 'evento-1',
          usaMapaAssentos: false,
          status: EventStatus.PUBLICADO,
        },
      },
    });
    tx.booking.aggregate.mockResolvedValue({ _sum: { quantidade: 0 } });
    tx.booking.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        id: 'booking-1',
        ...data,
      }),
    );

    const resultado = await service.reservar('cliente-1', 'sessao-1', {
      ticketTypeId: 'ticket-1',
      quantidade: 2,
    });

    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({ status: BookingStatus.PENDENTE }),
      }),
    );
    expect(stripeMock.criarPaymentIntent).toHaveBeenCalledWith(
      10000,
      'booking-1',
    );
    expect(resultado.clientSecret).toBe('secret_test');
    expect(resultado.bookingId).toBe('booking-1');
  });

  it('confirms a free booking immediately without calling Stripe', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      capacidade: 100,
      preco: { toString: () => '0' },
      gratuito: true,
      sessao: {
        id: 'sessao-1',
        dataHora: amanha,
        evento: {
          id: 'evento-1',
          usaMapaAssentos: false,
          status: EventStatus.PUBLICADO,
        },
      },
    });
    tx.booking.aggregate.mockResolvedValue({ _sum: { quantidade: 0 } });
    tx.booking.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        id: 'booking-1',
        ...data,
      }),
    );

    const resultado = await service.reservar('cliente-1', 'sessao-1', {
      ticketTypeId: 'ticket-1',
      quantidade: 1,
    });

    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          status: BookingStatus.CONFIRMADO,
          expiraEm: null,
        }),
      }),
    );
    expect(stripeMock.criarPaymentIntent).not.toHaveBeenCalled();
    expect(resultado.clientSecret).toBeNull();
    expect(resultado.bookingId).toBe('booking-1');
  });

  it('rolls back the reservation and frees seats if Stripe fails', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      capacidade: 80,
      preco: { toString: () => '50' },
      gratuito: false,
      sessao: {
        id: 'sessao-1',
        dataHora: amanha,
        evento: {
          id: 'evento-1',
          usaMapaAssentos: true,
          status: EventStatus.PUBLICADO,
        },
      },
    });
    tx.seat.findMany.mockResolvedValue([{ codigo: 'A1', bookingId: null }]);
    tx.booking.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        id: 'booking-1',
        ...data,
      }),
    );
    stripeMock.criarPaymentIntent.mockRejectedValue(
      new Error('Stripe indisponível'),
    );

    await expect(
      service.reservar('cliente-1', 'sessao-1', {
        ticketTypeId: 'ticket-1',
        assentos: ['A1'],
      }),
    ).rejects.toThrow('Não foi possível iniciar o pagamento');

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: BookingStatus.CANCELADO },
    });
    expect(prisma.seat.updateMany).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1' },
      data: { bookingId: null },
    });
  });

  describe('cancelar', () => {
    it('throws NotFoundException when the booking does not exist', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(service.cancelar('booking-1', 'cliente-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the booking belongs to another client', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        clienteId: 'outro-cliente',
        status: BookingStatus.CONFIRMADO,
        stripePaymentIntentId: null,
        sessao: { dataHora: amanha },
      });

      await expect(service.cancelar('booking-1', 'cliente-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ConflictException when the booking is already CANCELADO', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        clienteId: 'cliente-1',
        status: BookingStatus.CANCELADO,
        stripePaymentIntentId: null,
        sessao: { dataHora: amanha },
      });

      await expect(service.cancelar('booking-1', 'cliente-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException when the event already started', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        clienteId: 'cliente-1',
        status: BookingStatus.CONFIRMADO,
        stripePaymentIntentId: null,
        sessao: { dataHora: ontem },
      });

      await expect(service.cancelar('booking-1', 'cliente-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('cancels and frees seats without refunding a free booking', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        clienteId: 'cliente-1',
        status: BookingStatus.CONFIRMADO,
        stripePaymentIntentId: null,
        sessao: { dataHora: amanha },
      });

      await service.cancelar('booking-1', 'cliente-1');

      expect(stripeMock.criarReembolso).not.toHaveBeenCalled();
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: { status: BookingStatus.CANCELADO },
      });
      expect(prisma.seat.updateMany).toHaveBeenCalledWith({
        where: { bookingId: 'booking-1' },
        data: { bookingId: null },
      });
    });

    it('refunds via Stripe when the booking was paid', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        clienteId: 'cliente-1',
        status: BookingStatus.CONFIRMADO,
        stripePaymentIntentId: 'pi_test',
        sessao: { dataHora: amanha },
      });

      await service.cancelar('booking-1', 'cliente-1');

      expect(stripeMock.criarReembolso).toHaveBeenCalledWith('pi_test');
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: { status: BookingStatus.CANCELADO },
      });
    });

    it('refunds only the item value when the booking belongs to an Order', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        clienteId: 'cliente-1',
        status: BookingStatus.CONFIRMADO,
        stripePaymentIntentId: null,
        orderId: 'order-1',
        valorCentavos: 1500,
        sessao: { dataHora: amanha },
      });
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        stripePaymentIntentId: 'pi_order',
      });

      await service.cancelar('booking-1', 'cliente-1');

      expect(stripeMock.criarReembolso).toHaveBeenCalledWith('pi_order', 1500);
    });
  });

  describe('disponibilidade (assentos compartilhados por sessão)', () => {
    it('shares seat availability across ticketTypes with no fileira restriction', async () => {
      prisma.sessao.findUnique.mockResolvedValue({
        id: 'sessao-1',
        seats: [
          { codigo: 'A1', bookingId: null },
          { codigo: 'A2', bookingId: 'booking-existente' },
        ],
        ticketTypes: [
          {
            id: 'ticket-inteira',
            fileiraInicio: null,
            fileiraFim: null,
            capacidade: 80,
            bookings: [],
          },
          {
            id: 'ticket-meia',
            fileiraInicio: null,
            fileiraFim: null,
            capacidade: 80,
            bookings: [],
          },
        ],
      });

      const resultado = await service.disponibilidade('sessao-1');

      const inteira = resultado.find(
        (r) => r.ticketTypeId === 'ticket-inteira',
      )!;
      const meia = resultado.find((r) => r.ticketTypeId === 'ticket-meia')!;
      expect(inteira.assentosOcupados).toEqual(['A2']);
      expect(meia.assentosOcupados).toEqual(['A2']);
    });

    it('excludes seats restricted to another ticketType from disponivel/ocupados', async () => {
      prisma.sessao.findUnique.mockResolvedValue({
        id: 'sessao-1',
        seats: [
          { codigo: 'A1', bookingId: null },
          { codigo: 'B1', bookingId: null },
        ],
        ticketTypes: [
          {
            id: 'ticket-vip',
            fileiraInicio: 'A',
            fileiraFim: 'A',
            capacidade: 10,
            bookings: [],
          },
          {
            id: 'ticket-inteira',
            fileiraInicio: null,
            fileiraFim: null,
            capacidade: 70,
            bookings: [],
          },
        ],
      });

      const resultado = await service.disponibilidade('sessao-1');

      const vip = resultado.find((r) => r.ticketTypeId === 'ticket-vip')!;
      const inteira = resultado.find(
        (r) => r.ticketTypeId === 'ticket-inteira',
      )!;
      // VIP restringe a fileira A para si, mas fileira B não tem nenhum
      // restritor — então VIP também pode vender B1 (sem restrição = livre
      // para todos). Inteira não tem restrição própria, mas A1 é exclusivo
      // do VIP, então Inteira só enxerga B1.
      expect(vip.disponivel).toBe(2);
      expect(inteira.disponivel).toBe(1);
    });
  });
});
