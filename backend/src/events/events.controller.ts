import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CriarEventoDto } from './dto/criar-evento.dto';
import { AtualizarEventoDto } from './dto/atualizar-evento.dto';
import { ListarEventosDto } from './dto/listar-eventos.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get()
  listar(@Query() filtros: ListarEventosDto) {
    return this.eventsService.listar(filtros);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZADOR)
  @Get('meus')
  meusEventos(@Req() req: AuthenticatedRequest) {
    return this.eventsService.meusEventos(req.user.userId);
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string) {
    return this.eventsService.buscarPorId(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZADOR)
  @Post()
  criar(@Req() req: AuthenticatedRequest, @Body() dto: CriarEventoDto) {
    return this.eventsService.criar(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZADOR)
  @Patch(':id')
  atualizar(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AtualizarEventoDto,
  ) {
    return this.eventsService.atualizar(id, req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZADOR)
  @Delete(':id')
  cancelar(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.eventsService.cancelar(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZADOR)
  @Delete(':id/excluir')
  @HttpCode(HttpStatus.NO_CONTENT)
  excluir(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.eventsService.excluir(id, req.user.userId);
  }
}
