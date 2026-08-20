import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookingsCleanupService {
  private readonly logger = new Logger(BookingsCleanupService.name);

  constructor(private prisma: PrismaService) {}

  @Cron('*/1 * * * *')
  async expirarReservasVencidas(): Promise<number> {
    const vencidas = await this.prisma.booking.findMany({
      where: { status: BookingStatus.PENDENTE, expiraEm: { lt: new Date() } },
    });

    let totalExpirado = 0;
    for (const booking of vencidas) {
      const resultado = await this.prisma.booking.updateMany({
        where: { id: booking.id, status: BookingStatus.PENDENTE },
        data: { status: BookingStatus.EXPIRADO },
      });
      // Se count === 0, o status já mudou (ex.: webhook confirmou) entre o
      // findMany acima e este update — não libera o assento nesse caso.
      if (resultado.count === 0) continue;

      await this.prisma.seat.updateMany({
        where: { bookingId: booking.id },
        data: { bookingId: null },
      });
      totalExpirado += 1;
    }

    if (totalExpirado > 0) {
      this.logger.log(`${totalExpirado} reserva(s) expirada(s).`);
    }
    return totalExpirado;
  }
}
