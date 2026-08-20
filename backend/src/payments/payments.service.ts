import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  // Simula a criação de um payment intent, sem chamar nenhum provedor externo.
  criarPaymentIntent(bookingId: string) {
    return {
      id: `pi_sim_${randomUUID().replace(/-/g, '')}`,
      clientSecret: `pi_sim_${bookingId}_secret_${randomUUID().replace(/-/g, '')}`,
    };
  }

  // Simula a confirmação do pagamento (equivalente ao que um webhook real faria).
  async confirmar(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Reserva não encontrada.');
    if (booking.status !== BookingStatus.PENDENTE) return booking;

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CONFIRMADO },
    });
  }
}
