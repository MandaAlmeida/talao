import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../payments/stripe.service';

describe('OrdersService (unit, mocked Prisma)', () => {
  let service: OrdersService;
  let prisma: {
    $transaction: jest.Mock;
    order: {
      update: jest.Mock;
      findUnique: jest.Mock;
    };
    booking: { updateMany: jest.Mock };
    seat: { updateMany: jest.Mock };
  };
  let tx: {
    ticketType: { findUnique: jest.Mock; findMany: jest.Mock };
    seat: { findMany: jest.Mock; updateMany: jest.Mock };
    booking: { aggregate: jest.Mock; create: jest.Mock; updateMany: jest.Mock };
    order: { create: jest.Mock; update: jest.Mock };
  };
  let stripeMock: { criarPaymentIntent: jest.Mock };

  const eventoBase = {
    id: 'evento-1',
    usaMapaAssentos: false,
    status: EventStatus.PUBLICADO,
  };
  const amanha = new Date(Date.now() + 24 * 60 * 60_000);
  const sessaoBase = { id: 'sessao-1', dataHora: amanha, evento: eventoBase };

  beforeEach(async () => {
    tx = {
      ticketType: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      seat: { findMany: jest.fn(), updateMany: jest.fn() },
      booking: {
        aggregate: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      order: {
        create: jest.fn().mockResolvedValue({ id: 'order-1' }),
        update: jest.fn(),
      },
    };
    prisma = {
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => unknown)(tx)
          : Promise.all(arg as unknown[]),
      ),
      order: { update: jest.fn(), findUnique: jest.fn() },
      booking: { updateMany: jest.fn() },
      seat: { updateMany: jest.fn() },
    };
    stripeMock = {
      criarPaymentIntent: jest
        .fn()
        .mockResolvedValue({ id: 'pi_test', clientSecret: 'secret_test' }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => 'test-qr-secret' } },
        { provide: StripeService, useValue: stripeMock },
      ],
    }).compile();

    service = moduleRef.get(OrdersService);
  });

  it('rejects two items with the same ticketTypeId', async () => {
    await expect(
      service.criar('cliente-1', 'sessao-1', {
        itens: [
          { ticketTypeId: 'ticket-1', quantidade: 1 },
          { ticketTypeId: 'ticket-1', quantidade: 1 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires assentos matching quantidade when the event uses seat maps', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      nome: 'Pista',
      capacidade: 80,
      preco: { toString: () => '50' },
      gratuito: false,
      sessao: {
        ...sessaoBase,
        evento: { ...eventoBase, usaMapaAssentos: true },
      },
    });

    await expect(
      service.criar('cliente-1', 'sessao-1', {
        itens: [{ ticketTypeId: 'ticket-1', quantidade: 2, assentos: ['A1'] }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a seat outside the fileira permitted for the ticketType', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-vip',
      nome: 'VIP',
      capacidade: 10,
      preco: { toString: () => '100' },
      gratuito: false,
      fileiraInicio: 'A',
      fileiraFim: 'A',
      sessao: {
        ...sessaoBase,
        evento: { ...eventoBase, usaMapaAssentos: true },
      },
    });
    tx.seat.findMany.mockResolvedValue([
      { codigo: 'B1', sessaoId: 'sessao-1', bookingId: null },
    ]);
    tx.ticketType.findMany.mockResolvedValue([
      { id: 'ticket-inteira', fileiraInicio: 'B', fileiraFim: 'H' },
    ]);

    await expect(
      service.criar('cliente-1', 'sessao-1', {
        itens: [
          { ticketTypeId: 'ticket-vip', quantidade: 1, assentos: ['B1'] },
        ],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects an unknown ticketTypeId', async () => {
    tx.ticketType.findUnique.mockResolvedValue(null);

    await expect(
      service.criar('cliente-1', 'sessao-1', {
        itens: [{ ticketTypeId: 'ticket-1', quantidade: 1 }],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects buying for a sessão that already started', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      nome: 'Pista',
      capacidade: 10,
      preco: { toString: () => '20' },
      gratuito: false,
      sessao: { ...sessaoBase, dataHora: new Date(Date.now() - 1000) },
    });

    await expect(
      service.criar('cliente-1', 'sessao-1', {
        itens: [{ ticketTypeId: 'ticket-1', quantidade: 1 }],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects buying a ticketType whose vendaInicio has not arrived yet', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      nome: 'Pista',
      capacidade: 10,
      preco: { toString: () => '20' },
      gratuito: false,
      vendaInicio: new Date(Date.now() + 60_000),
      sessao: sessaoBase,
    });

    await expect(
      service.criar('cliente-1', 'sessao-1', {
        itens: [{ ticketTypeId: 'ticket-1', quantidade: 1 }],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects buying a ticketType whose vendaFim already passed', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      nome: 'Pista',
      capacidade: 10,
      preco: { toString: () => '20' },
      gratuito: false,
      vendaFim: new Date(Date.now() - 60_000),
      sessao: sessaoBase,
    });

    await expect(
      service.criar('cliente-1', 'sessao-1', {
        itens: [{ ticketTypeId: 'ticket-1', quantidade: 1 }],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when quantity-based stock is insufficient', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      nome: 'Pista',
      capacidade: 10,
      preco: { toString: () => '20' },
      gratuito: false,
      sessao: sessaoBase,
    });
    tx.booking.aggregate.mockResolvedValue({ _sum: { quantidade: 9 } });

    await expect(
      service.criar('cliente-1', 'sessao-1', {
        itens: [{ ticketTypeId: 'ticket-1', quantidade: 2 }],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('creates one Booking per item and a single PaymentIntent for the total', async () => {
    tx.ticketType.findUnique
      .mockResolvedValueOnce({
        id: 'ticket-1',
        nome: 'Pista',
        capacidade: 100,
        preco: { toString: () => '50' },
        gratuito: false,
        sessao: sessaoBase,
      })
      .mockResolvedValueOnce({
        id: 'ticket-2',
        nome: 'VIP',
        capacidade: 100,
        preco: { toString: () => '100' },
        gratuito: false,
        sessao: sessaoBase,
      });
    tx.booking.aggregate.mockResolvedValue({ _sum: { quantidade: 0 } });
    let contador = 0;
    tx.booking.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        id: `booking-${++contador}`,
        ...data,
      }),
    );
    prisma.order.update.mockResolvedValue({
      id: 'order-1',
      stripePaymentIntentId: 'pi_test',
    });

    const resultado = await service.criar('cliente-1', 'sessao-1', {
      itens: [
        { ticketTypeId: 'ticket-1', quantidade: 2 },
        { ticketTypeId: 'ticket-2', quantidade: 1 },
      ],
    });

    // 2 * R$50 + 1 * R$100 = R$200 = 20000 centavos
    expect(stripeMock.criarPaymentIntent).toHaveBeenCalledWith(
      20000,
      'order-1',
    );
    expect(resultado.orderId).toBe('order-1');
    expect(resultado.bookingIds).toEqual(['booking-1', 'booking-2']);
    expect(resultado.clientSecret).toBe('secret_test');

    // regression: Order.eventoId é obrigatório (FK) — precisa vir preenchido
    // com o evento real já no create, nunca um placeholder vazio.
    const chamadaOrder = tx.order.create.mock.calls[0] as [
      { data: { eventoId: string } },
    ];
    expect(chamadaOrder[0].data.eventoId).toBe('evento-1');
  });

  it('confirms every booking immediately when all items are free', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      nome: 'Pista',
      capacidade: 100,
      preco: { toString: () => '0' },
      gratuito: true,
      sessao: sessaoBase,
    });
    tx.booking.aggregate.mockResolvedValue({ _sum: { quantidade: 0 } });
    tx.booking.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        id: 'booking-1',
        ...data,
      }),
    );

    const resultado = await service.criar('cliente-1', 'sessao-1', {
      itens: [{ ticketTypeId: 'ticket-1', quantidade: 1 }],
    });

    expect(stripeMock.criarPaymentIntent).not.toHaveBeenCalled();
    expect(resultado.clientSecret).toBeNull();
  });

  describe('buscarPorId', () => {
    it('throws NotFoundException when the order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.buscarPorId('order-1', 'cliente-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the order belongs to another client', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        clienteId: 'outro-cliente',
        bookings: [],
      });

      await expect(service.buscarPorId('order-1', 'cliente-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns the order with its bookings', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        clienteId: 'cliente-1',
        status: 'CONFIRMADO',
        bookings: [{ id: 'booking-1', status: 'CONFIRMADO' }],
      });

      const resultado = await service.buscarPorId('order-1', 'cliente-1');

      expect(resultado.bookings).toHaveLength(1);
    });
  });
});
