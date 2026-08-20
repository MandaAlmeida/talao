import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import type Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private prisma: PrismaService) {}

  async processarEvento(event: Stripe.Event) {
    if (event.type === 'payment_intent.succeeded') {
      await this.confirmar(event.data.object);
    } else if (event.type === 'payment_intent.payment_failed') {
      await this.cancelar(event.data.object);
    } else {
      this.logger.debug(`Evento Stripe ignorado: ${event.type}`);
    }
  }

  private async confirmar(paymentIntent: Stripe.PaymentIntent) {
    const booking = await this.prisma.booking.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });
    if (!booking || booking.status !== BookingStatus.PENDENTE) return;

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CONFIRMADO },
    });
  }

  private async cancelar(paymentIntent: Stripe.PaymentIntent) {
    const booking = await this.prisma.booking.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });
    if (!booking || booking.status !== BookingStatus.PENDENTE) return;

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CANCELADO },
    });
    await this.prisma.seat.updateMany({
      where: { bookingId: booking.id },
      data: { bookingId: null },
    });
  }
}
