import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../payments/stripe.service';

describe('BookingsService (unit, mocked Prisma)', () => {
  let service: BookingsService;
  let prisma: {
    $transaction: jest.Mock;
    booking: { update: jest.Mock };
    seat: { updateMany: jest.Mock };
  };
  let tx: {
    ticketType: { findUnique: jest.Mock };
    seat: { findMany: jest.Mock; updateMany: jest.Mock };
    booking: { aggregate: jest.Mock; create: jest.Mock };
  };
  let stripeMock: { criarPaymentIntent: jest.Mock };

  beforeEach(async () => {
    tx = {
      ticketType: { findUnique: jest.fn() },
      seat: { findMany: jest.fn(), updateMany: jest.fn() },
      booking: { aggregate: jest.fn(), create: jest.fn() },
    };
    prisma = {
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(tx) : Promise.all(arg as unknown[]),
      ),
      booking: { update: jest.fn().mockResolvedValue({ id: 'booking-1', expiraEm: new Date() }) },
      seat: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    stripeMock = {
      criarPaymentIntent: jest.fn().mockResolvedValue({ id: 'pi_test', clientSecret: 'secret_test' }),
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

  it('rejects when quantity-based stock is insufficient', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      capacidade: 10,
      preco: { toString: () => '20' },
      gratuito: false,
      evento: { id: 'evento-1', usaMapaAssentos: false },
    });
    tx.booking.aggregate.mockResolvedValue({ _sum: { quantidade: 9 } });

    await expect(
      service.reservar('cliente-1', 'evento-1', { ticketTypeId: 'ticket-1', quantidade: 2 }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when a requested seat is already taken', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      capacidade: 80,
      preco: { toString: () => '20' },
      gratuito: false,
      evento: { id: 'evento-1', usaMapaAssentos: true },
    });
    tx.seat.findMany.mockResolvedValue([
      { codigo: 'A1', bookingId: null },
      { codigo: 'A2', bookingId: 'booking-existing' },
    ]);

    await expect(
      service.reservar('cliente-1', 'evento-1', { ticketTypeId: 'ticket-1', assentos: ['A1', 'A2'] }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a seat-based booking with no assentos provided', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      capacidade: 80,
      preco: { toString: () => '20' },
      gratuito: false,
      evento: { id: 'evento-1', usaMapaAssentos: true },
    });

    await expect(
      service.reservar('cliente-1', 'evento-1', { ticketTypeId: 'ticket-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates a PENDENTE booking and a Stripe PaymentIntent', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      capacidade: 100,
      preco: { toString: () => '50' },
      gratuito: false,
      evento: { id: 'evento-1', usaMapaAssentos: false },
    });
    tx.booking.aggregate.mockResolvedValue({ _sum: { quantidade: 0 } });
    tx.booking.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'booking-1',
      ...data,
    }));

    const resultado = await service.reservar('cliente-1', 'evento-1', {
      ticketTypeId: 'ticket-1',
      quantidade: 2,
    });

    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.PENDENTE }) }),
    );
    expect(stripeMock.criarPaymentIntent).toHaveBeenCalledWith(10000, 'booking-1');
    expect(resultado.clientSecret).toBe('secret_test');
    expect(resultado.bookingId).toBe('booking-1');
  });

  it('confirms a free booking immediately without calling Stripe', async () => {
    tx.ticketType.findUnique.mockResolvedValue({
      id: 'ticket-1',
      capacidade: 100,
      preco: { toString: () => '0' },
      gratuito: true,
      evento: { id: 'evento-1', usaMapaAssentos: false },
    });
    tx.booking.aggregate.mockResolvedValue({ _sum: { quantidade: 0 } });
    tx.booking.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'booking-1',
      ...data,
    }));

    const resultado = await service.reservar('cliente-1', 'evento-1', {
      ticketTypeId: 'ticket-1',
      quantidade: 1,
    });

    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.CONFIRMADO, expiraEm: null }) }),
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
      evento: { id: 'evento-1', usaMapaAssentos: true },
    });
    tx.seat.findMany.mockResolvedValue([{ codigo: 'A1', bookingId: null }]);
    tx.booking.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'booking-1',
      ...data,
    }));
    stripeMock.criarPaymentIntent.mockRejectedValue(new Error('Stripe indisponível'));

    await expect(
      service.reservar('cliente-1', 'evento-1', { ticketTypeId: 'ticket-1', assentos: ['A1'] }),
    ).rejects.toThrow('Stripe indisponível');

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: BookingStatus.CANCELADO },
    });
    expect(prisma.seat.updateMany).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1' },
      data: { bookingId: null },
    });
  });
});
