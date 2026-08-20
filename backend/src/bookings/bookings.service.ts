import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CriarBookingDto } from './dto/criar-booking.dto';
import { assinarCodigo, gerarCodigoCompra } from './qr.util';

function calcularValorCentavos(preco: Prisma.Decimal, quantidade: number, gratuito: boolean): number {
  if (gratuito) return 0;
  return Math.round(Number(preco) * quantidade * 100);
}

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private payments: PaymentsService,
  ) {}

  async disponibilidade(eventoId: string) {
    const ticketTypes = await this.prisma.ticketType.findMany({
      where: { eventoId },
      include: {
        seats: true,
        bookings: {
          where: {
            status: { in: [BookingStatus.CONFIRMADO, BookingStatus.USADO, BookingStatus.PENDENTE] },
          },
        },
      },
    });

    return ticketTypes.map((tt) => {
      const vendidos = tt.bookings.reduce((total, b) => total + b.quantidade, 0);
      return {
        ticketTypeId: tt.id,
        disponivel: Math.max(0, tt.capacidade - vendidos),
        assentosOcupados: tt.seats.filter((s) => s.bookingId).map((s) => s.codigo),
      };
    });
  }

  async reservar(clienteId: string, eventoId: string, dto: CriarBookingDto) {
    const secret = this.config.get<string>('QR_SECRET')!;

    const { booking, valorCentavos } = await this.prisma.$transaction(async (tx) => {
      const ticketType = await tx.ticketType.findUnique({
        where: { id: dto.ticketTypeId },
        include: { evento: true },
      });

      if (!ticketType || ticketType.evento.id !== eventoId) {
        throw new NotFoundException('Tipo de ingresso não encontrado para este evento.');
      }

      const usaAssentos = ticketType.evento.usaMapaAssentos;
      let quantidade: number;

      if (usaAssentos) {
        if (!dto.assentos || dto.assentos.length === 0) {
          throw new BadRequestException('Selecione ao menos um assento para este evento.');
        }
        quantidade = dto.assentos.length;

        const assentos = await tx.seat.findMany({
          where: { ticketTypeId: ticketType.id, codigo: { in: dto.assentos } },
        });

        if (assentos.length !== dto.assentos.length) {
          throw new NotFoundException('Um ou mais assentos informados não existem.');
        }
        if (assentos.some((a) => a.bookingId !== null)) {
          throw new ConflictException('Um ou mais assentos selecionados já foram reservados.');
        }
      } else {
        quantidade = dto.quantidade ?? 1;

        const agregado = await tx.booking.aggregate({
          where: {
            ticketTypeId: ticketType.id,
            status: { in: [BookingStatus.CONFIRMADO, BookingStatus.USADO, BookingStatus.PENDENTE] },
          },
          _sum: { quantidade: true },
        });
        const vendidos = agregado._sum.quantidade ?? 0;
        const disponivel = ticketType.capacidade - vendidos;

        if (quantidade > disponivel) {
          throw new ConflictException(
            `Apenas ${disponivel} ingresso(s) disponível(is) para este tipo.`,
          );
        }
      }

      const codigoCompra = gerarCodigoCompra();
      const qrAssinatura = assinarCodigo(codigoCompra, secret);
      const valorCentavos = calcularValorCentavos(ticketType.preco, quantidade, ticketType.gratuito);
      const gratis = valorCentavos === 0;

      const novaBooking = await tx.booking.create({
        data: {
          eventoId,
          ticketTypeId: ticketType.id,
          clienteId,
          quantidade,
          status: gratis ? BookingStatus.CONFIRMADO : BookingStatus.PENDENTE,
          codigoCompra,
          qrAssinatura,
          expiraEm: gratis ? null : new Date(Date.now() + 10 * 60_000),
        },
      });

      if (usaAssentos && dto.assentos) {
        await tx.seat.updateMany({
          where: { ticketTypeId: ticketType.id, codigo: { in: dto.assentos } },
          data: { bookingId: novaBooking.id },
        });
      }

      return { booking: novaBooking, valorCentavos };
    });

    if (valorCentavos === 0) {
      return { bookingId: booking.id, clientSecret: null, expiraEm: null };
    }

    let paymentIntent: { id: string; clientSecret: string };
    try {
      paymentIntent = this.payments.criarPaymentIntent(booking.id);
    } catch (err) {
      await this.prisma.$transaction([
        this.prisma.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CANCELADO } }),
        this.prisma.seat.updateMany({ where: { bookingId: booking.id }, data: { bookingId: null } }),
      ]);
      throw err;
    }

    const atualizada = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    return {
      bookingId: atualizada.id,
      clientSecret: paymentIntent.clientSecret,
      expiraEm: atualizada.expiraEm!,
    };
  }

  async minhas(clienteId: string) {
    return this.prisma.booking.findMany({
      where: { clienteId },
      include: { evento: true, ticketType: true, seats: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async buscarPorId(id: string, clienteId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { evento: true, ticketType: true, seats: true },
    });
    if (!booking) throw new NotFoundException('Ingresso não encontrado.');
    if (booking.clienteId !== clienteId) {
      throw new ForbiddenException('Este ingresso não pertence a você.');
    }
    return booking;
  }

  async buscarPorShareToken(shareToken: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { shareToken },
      include: { evento: true, ticketType: true },
    });
    if (!booking) throw new NotFoundException('Ingresso não encontrado.');
    return booking;
  }
}

export type { Prisma };
