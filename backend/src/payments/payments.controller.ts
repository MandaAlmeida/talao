import { Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

// Endpoint de simulação de pagamento: em produção, isto seria substituído por um
// webhook do provedor de pagamentos (ex: Stripe) — aqui, o próprio cliente confirma.
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLIENTE)
  @HttpCode(HttpStatus.OK)
  @Post('simular/:bookingId/confirmar')
  confirmar(@Param('bookingId') bookingId: string) {
    return this.paymentsService.confirmar(bookingId);
  }
}
