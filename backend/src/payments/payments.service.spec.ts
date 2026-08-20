import { Test } from '@nestjs/testing';
import { BookingStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: {
    booking: { findUnique: jest.Mock; update: jest.Mock };
    seat: { updateMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      booking: { findUnique: jest.fn(), update: jest.fn() },
      seat: { updateMany: jest.fn() },
    };

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
});
