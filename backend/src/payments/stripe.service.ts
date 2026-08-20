import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly client: Stripe;
  private readonly webhookSecret: string;

  constructor(private config: ConfigService) {
    this.client = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!);
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')!;
  }

  async criarPaymentIntent(valorCentavos: number, bookingId: string) {
    const intent = await this.client.paymentIntents.create({
      amount: valorCentavos,
      currency: 'brl',
      metadata: { bookingId },
    });
    return { id: intent.id, clientSecret: intent.client_secret! };
  }

  verificarAssinaturaWebhook(payload: Buffer, assinatura: string): Stripe.Event {
    return this.client.webhooks.constructEvent(payload, assinatura, this.webhookSecret);
  }
}
