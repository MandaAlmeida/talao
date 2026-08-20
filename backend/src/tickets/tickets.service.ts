import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ValidarTicketDto } from './dto/validar-ticket.dto';
import { verificarAssinatura } from '../bookings/qr.util';

export type Situacao = 'valido' | 'invalido' | 'ja-utilizado' | 'evento-errado';

export interface ResultadoValidacao {
  codigo: string;
  situacao: Situacao;
  mensagem: string;
  detalhe?: string;
}

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async validar(dto: ValidarTicketDto): Promise<ResultadoValidacao> {
    const codigo = dto.codigo.trim().toUpperCase();
    const secret = this.config.get<string>('QR_SECRET')!;

    const booking = await this.prisma.booking.findUnique({
      where: { codigoCompra: codigo },
      include: { ticketType: true },
    });

    if (!booking || !verificarAssinatura(codigo, booking.qrAssinatura, secret)) {
      return {
        codigo,
        situacao: 'invalido',
        mensagem: 'Código não encontrado ou assinatura inválida.',
      };
    }

    if (booking.status === BookingStatus.CANCELADO) {
      return { codigo, situacao: 'invalido', mensagem: 'Ingresso cancelado.' };
    }

    if (booking.status === BookingStatus.PENDENTE) {
      return { codigo, situacao: 'invalido', mensagem: 'Pagamento deste ingresso ainda não foi confirmado.' };
    }

    if (booking.status === BookingStatus.EXPIRADO) {
      return { codigo, situacao: 'invalido', mensagem: 'Reserva deste ingresso expirou sem pagamento.' };
    }

    if (booking.eventoId !== dto.eventoId) {
      const eventoDaCompra = await this.prisma.event.findUnique({
        where: { id: booking.eventoId },
      });
      return {
        codigo,
        situacao: 'evento-errado',
        mensagem: 'Este ingresso pertence a outro evento.',
        detalhe: eventoDaCompra?.titulo,
      };
    }

    if (booking.status === BookingStatus.USADO) {
      return {
        codigo,
        situacao: 'ja-utilizado',
        mensagem: 'Este ingresso já foi utilizado na entrada.',
      };
    }

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.USADO, usadoEm: new Date() },
    });

    return {
      codigo,
      situacao: 'valido',
      mensagem: 'Entrada liberada.',
      detalhe: `${booking.ticketType.nome} · ${booking.quantidade} ${booking.quantidade > 1 ? 'ingressos' : 'ingresso'}`,
    };
  }
}
