import { Test } from '@nestjs/testing';
import { BookingStatus, OrderStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: {
    booking: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findMany: jest.Mock;
    };
    seat: { updateMany: jest.Mock };
    order: { findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      booking: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      seat: { updateMany: jest.fn() },
      order: { findUnique: jest.fn(), update: jest.fn() },
    };
    // Fluxo legado por padrão: nenhuma Order associada ao PaymentIntent.
    prisma.order.findUnique.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(PaymentsService);
  });

  it('confirms a PENDENTE booking on payment_intent.succeeded', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      status: BookingStatus.PENDENTE,
    });

    await service.processarEvento({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test' } },
    } as never);

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: BookingStatus.CONFIRMADO },
    });
  });

  it('is idempotent: does nothing if booking is no longer PENDENTE', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      status: BookingStatus.CONFIRMADO,
    });

    await service.processarEvento({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test' } },
    } as never);

    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('cancels and frees seats on payment_intent.payment_failed', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      status: BookingStatus.PENDENTE,
    });

    await service.processarEvento({
      type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_test' } },
    } as never);

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: BookingStatus.CANCELADO },
    });
    expect(prisma.seat.updateMany).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1' },
      data: { bookingId: null },
    });
  });

  it('ignores unrelated event types', async () => {
    await service.processarEvento({
      type: 'charge.refunded',
      data: { object: {} },
    } as never);
    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
  });

  it('confirms all bookings of an Order when its PaymentIntent succeeds', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.PENDENTE,
    });

    await service.processarEvento({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_order' } },
    } as never);

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: OrderStatus.CONFIRMADO },
    });
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
      data: { status: BookingStatus.CONFIRMADO },
    });
    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
  });

  it('is idempotent: does nothing if the Order is no longer PENDENTE', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.CONFIRMADO,
    });

    await service.processarEvento({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_order' } },
    } as never);

    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('cancels all bookings and frees seats of an Order when its PaymentIntent fails', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.PENDENTE,
    });
    prisma.booking.findMany.mockResolvedValue([
      { id: 'booking-1' },
      { id: 'booking-2' },
    ]);

    await service.processarEvento({
      type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_order' } },
    } as never);

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: OrderStatus.CANCELADO },
    });
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
      data: { status: BookingStatus.CANCELADO },
    });
    expect(prisma.seat.updateMany).toHaveBeenCalledWith({
      where: { bookingId: { in: ['booking-1', 'booking-2'] } },
      data: { bookingId: null },
    });
  });
});
