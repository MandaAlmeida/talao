import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CriarOrderDto } from './dto/criar-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';

@ApiTags('orders')
@ApiBearerAuth()
@Controller()
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLIENTE)
  @Post('sessoes/:sessaoId/orders')
  criar(
    @Req() req: AuthenticatedRequest,
    @Param('sessaoId') sessaoId: string,
    @Body() dto: CriarOrderDto,
  ) {
    return this.ordersService.criar(req.user.userId, sessaoId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLIENTE)
  @Get('orders/:id')
  buscarPorId(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.ordersService.buscarPorId(id, req.user.userId);
  }
}
