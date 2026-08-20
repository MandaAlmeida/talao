import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { ApiExcludeController } from '@nestjs/swagger';
import { StripeService } from './stripe.service';
import { PaymentsService } from './payments.service';

// Webhook consumido pela Stripe, não por clientes da API — excluído do Swagger.
@ApiExcludeController()
@Controller('webhooks/stripe')
export class PaymentsController {
  constructor(
    private stripeService: StripeService,
    private paymentsService: PaymentsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async receberWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') assinatura: string,
  ) {
    if (!assinatura)
      throw new BadRequestException('Assinatura do webhook ausente.');

    let event: Stripe.Event;
    try {
      event = this.stripeService.verificarAssinaturaWebhook(
        req.body as Buffer,
        assinatura,
      );
    } catch {
      throw new BadRequestException('Assinatura do webhook inválida.');
    }

    await this.paymentsService.processarEvento(event);
    return { received: true };
  }
}
