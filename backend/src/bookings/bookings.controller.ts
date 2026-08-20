import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CriarBookingDto } from './dto/criar-booking.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller()
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Get('events/:eventoId/disponibilidade')
  disponibilidade(@Param('eventoId') eventoId: string) {
    return this.bookingsService.disponibilidade(eventoId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLIENTE)
  @Post('events/:eventoId/bookings')
  reservar(
    @Req() req: AuthenticatedRequest,
    @Param('eventoId') eventoId: string,
    @Body() dto: CriarBookingDto,
  ) {
    return this.bookingsService.reservar(req.user.userId, eventoId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLIENTE)
  @Get('bookings/minhas')
  minhas(@Req() req: AuthenticatedRequest) {
    return this.bookingsService.minhas(req.user.userId);
  }

  @Get('bookings/shared/:shareToken')
  buscarPorShareToken(@Param('shareToken') shareToken: string) {
    return this.bookingsService.buscarPorShareToken(shareToken);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLIENTE)
  @Get('bookings/:id')
  buscarPorId(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.bookingsService.buscarPorId(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLIENTE)
  @Delete('bookings/:id')
  cancelar(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.bookingsService.cancelar(id, req.user.userId);
  }
}
