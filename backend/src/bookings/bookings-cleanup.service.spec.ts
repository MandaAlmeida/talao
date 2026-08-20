import { Test } from '@nestjs/testing';
import { BookingStatus } from '@prisma/client';
import { BookingsCleanupService } from './bookings-cleanup.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BookingsCleanupService', () => {
  let service: BookingsCleanupService;
  let prisma: {
    booking: { findMany: jest.Mock; updateMany: jest.Mock };
    seat: { updateMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      booking: { findMany: jest.fn(), updateMany: jest.fn() },
      seat: { updateMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [BookingsCleanupService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(BookingsCleanupService);
  });

  it('expires PENDENTE bookings past their expiraEm and frees seats', async () => {
    prisma.booking.findMany.mockResolvedValue([{ id: 'booking-1' }, { id: 'booking-2' }]);
    prisma.booking.updateMany.mockResolvedValue({ count: 1 });

    const total = await service.expirarReservasVencidas();

    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: { status: BookingStatus.PENDENTE, expiraEm: { lt: expect.any(Date) } },
    });
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: BookingStatus.PENDENTE },
      data: { status: BookingStatus.EXPIRADO },
    });
    expect(prisma.seat.updateMany).toHaveBeenCalledTimes(2);
    expect(total).toBe(2);
  });

  it('does nothing when there are no expired bookings', async () => {
    prisma.booking.findMany.mockResolvedValue([]);

    const total = await service.expirarReservasVencidas();

    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(total).toBe(0);
  });

  it('does not free seats when the booking was confirmed between findMany and update (race with webhook)', async () => {
    prisma.booking.findMany.mockResolvedValue([{ id: 'booking-1' }]);
    prisma.booking.updateMany.mockResolvedValue({ count: 0 });

    const total = await service.expirarReservasVencidas();

    expect(prisma.seat.updateMany).not.toHaveBeenCalled();
    expect(total).toBe(0);
  });
});
