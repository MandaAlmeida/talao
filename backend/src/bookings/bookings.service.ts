import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, EventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../payments/stripe.service';
import { CriarBookingDto } from './dto/criar-booking.dto';
import { assinarCodigo, gerarCodigoCompra } from './qr.util';

const FILEIRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function calcularValorCentavos(
  preco: Prisma.Decimal,
  quantidade: number,
  gratuito: boolean,
): number {
  if (gratuito) return 0;
  return Math.round(Number(preco) * quantidade * 100);
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private stripe: StripeService,
  ) {}

  async disponibilidade(sessaoId: string) {
    const sessao = await this.prisma.sessao.findUnique({
      where: { id: sessaoId },
      include: {
        seats: true,
        ticketTypes: {
          include: {
            bookings: {
              where: {
                status: {
                  in: [
                    BookingStatus.CONFIRMADO,
                    BookingStatus.USADO,
                    BookingStatus.PENDENTE,
                  ],
                },
              },
            },
          },
        },
      },
    });

    if (!sessao) return [];

    const restritoresPorFileira = new Map<string, string[]>();
    for (const tt of sessao.ticketTypes) {
      if (!tt.fileiraInicio || !tt.fileiraFim) continue;
      const ini = FILEIRAS.indexOf(tt.fileiraInicio);
      const fim = FILEIRAS.indexOf(tt.fileiraFim);
      for (let i = ini; i <= fim; i++) {
        const fileira = FILEIRAS[i];
        restritoresPorFileira.set(fileira, [
          ...(restritoresPorFileira.get(fileira) ?? []),
          tt.id,
        ]);
      }
    }

    const assentoPermitido = (
      codigo: string,
      tt: {
        id: string;
        fileiraInicio: string | null;
        fileiraFim: string | null;
      },
    ) => {
      const fileira = codigo[0];

      if (tt.fileiraInicio && tt.fileiraFim) {
        const ini = FILEIRAS.indexOf(tt.fileiraInicio);
        const fim = FILEIRAS.indexOf(tt.fileiraFim);
        const idx = FILEIRAS.indexOf(fileira);
        if (idx < ini || idx > fim) return false;
      }

      const restritores = restritoresPorFileira.get(fileira);
      return !restritores || restritores.includes(tt.id);
    };

    return sessao.ticketTypes.map((tt) => {
      const assentosPermitidos = sessao.seats.filter((s) =>
        assentoPermitido(s.codigo, tt),
      );
      const vendidos = tt.bookings.reduce(
        (total, b) => total + b.quantidade,
        0,
      );
      const usaAssentos = sessao.seats.length > 0;
      const assentosLivres = assentosPermitidos.filter(
        (s) => !s.bookingId,
      ).length;
      return {
        ticketTypeId: tt.id,
        disponivel: usaAssentos
          ? Math.max(0, Math.min(assentosLivres, tt.capacidade - vendidos))
          : Math.max(0, tt.capacidade - vendidos),
        assentosOcupados: assentosPermitidos
          .filter((s) => s.bookingId)
          .map((s) => s.codigo),
      };
    });
  }

  async reservar(clienteId: string, sessaoId: string, dto: CriarBookingDto) {
    const secret = this.config.get<string>('QR_SECRET')!;

    const { booking, valorCentavos } = await this.prisma.$transaction(
      async (tx) => {
        const ticketType = await tx.ticketType.findUnique({
          where: { id: dto.ticketTypeId },
          include: { sessao: { include: { evento: true } } },
        });

        if (!ticketType || ticketType.sessao.id !== sessaoId) {
          throw new NotFoundException(
            'Tipo de ingresso não encontrado para esta sessão.',
          );
        }

        const evento = ticketType.sessao.evento;

        if (
          evento.status === EventStatus.RASCUNHO ||
          evento.status === EventStatus.EM_BREVE
        ) {
          throw new ConflictException(
            'Este evento ainda não está com as vendas abertas.',
          );
        }

        if (ticketType.sessao.dataHora.getTime() <= Date.now()) {
          throw new ConflictException('Este evento já começou.');
        }

        if (
          ticketType.vendaInicio &&
          ticketType.vendaInicio.getTime() > Date.now()
        ) {
          throw new ConflictException(
            `As vendas de "${ticketType.nome}" ainda não começaram.`,
          );
        }
        if (ticketType.vendaFim && ticketType.vendaFim.getTime() < Date.now()) {
          throw new ConflictException(
            `As vendas de "${ticketType.nome}" já foram encerradas.`,
          );
        }

        const usaAssentos = evento.usaMapaAssentos;
        let quantidade: number;

        if (usaAssentos) {
          if (!dto.assentos || dto.assentos.length === 0) {
            throw new BadRequestException(
              'Selecione ao menos um assento para este evento.',
            );
          }
          quantidade = dto.assentos.length;

          const outrosTicketTypes = await tx.ticketType.findMany({
            where: { sessaoId, id: { not: ticketType.id } },
            select: { id: true, fileiraInicio: true, fileiraFim: true },
          });
          const restritores = [
            ...outrosTicketTypes,
            {
              id: ticketType.id,
              fileiraInicio: ticketType.fileiraInicio,
              fileiraFim: ticketType.fileiraFim,
            },
          ].filter((t) => t.fileiraInicio && t.fileiraFim);

          const assentoPermitido = (codigo: string) => {
            const fileira = codigo[0];
            const idx = FILEIRAS.indexOf(fileira);

            if (ticketType.fileiraInicio && ticketType.fileiraFim) {
              const iniProprio = FILEIRAS.indexOf(ticketType.fileiraInicio);
              const fimProprio = FILEIRAS.indexOf(ticketType.fileiraFim);
              if (idx < iniProprio || idx > fimProprio) return false;
            }

            const donos = restritores.filter((t) => {
              const ini = FILEIRAS.indexOf(t.fileiraInicio!);
              const fim = FILEIRAS.indexOf(t.fileiraFim!);
              return idx >= ini && idx <= fim;
            });
            return (
              donos.length === 0 || donos.some((d) => d.id === ticketType.id)
            );
          };

          const foraDeAlcance = dto.assentos.filter(
            (c) => !assentoPermitido(c),
          );
          if (foraDeAlcance.length > 0) {
            throw new ConflictException(
              `Assento(s) ${foraDeAlcance.join(', ')} não disponível(is) para este tipo.`,
            );
          }

          const assentos = await tx.seat.findMany({
            where: {
              sessaoId,
              codigo: { in: dto.assentos },
            },
          });

          if (assentos.length !== dto.assentos.length) {
            throw new NotFoundException(
              'Um ou mais assentos informados não existem.',
            );
          }
          if (assentos.some((a) => a.bookingId !== null)) {
            throw new ConflictException(
              'Um ou mais assentos selecionados já foram reservados.',
            );
          }

          const agregadoAssentos = await tx.booking.aggregate({
            where: {
              ticketTypeId: ticketType.id,
              status: {
                in: [
                  BookingStatus.CONFIRMADO,
                  BookingStatus.USADO,
                  BookingStatus.PENDENTE,
                ],
              },
            },
            _sum: { quantidade: true },
          });
          const vendidosAssentos = agregadoAssentos._sum.quantidade ?? 0;
          const disponivelAssentos = ticketType.capacidade - vendidosAssentos;

          if (quantidade > disponivelAssentos) {
            throw new ConflictException(
              `Apenas ${disponivelAssentos} ingresso(s) disponível(is) para este tipo.`,
            );
          }
        } else {
          quantidade = dto.quantidade ?? 1;

          const agregado = await tx.booking.aggregate({
            where: {
              ticketTypeId: ticketType.id,
              status: {
                in: [
                  BookingStatus.CONFIRMADO,
                  BookingStatus.USADO,
                  BookingStatus.PENDENTE,
                ],
              },
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
        const valorCentavos = calcularValorCentavos(
          ticketType.preco,
          quantidade,
          ticketType.gratuito,
        );
        const gratis = valorCentavos === 0;

        const novaBooking = await tx.booking.create({
          data: {
            eventoId: evento.id,
            sessaoId,
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
            where: {
              sessaoId,
              codigo: { in: dto.assentos },
            },
            data: { bookingId: novaBooking.id },
          });
        }

        return { booking: novaBooking, valorCentavos };
      },
    );

    if (valorCentavos === 0) {
      return { bookingId: booking.id, clientSecret: null, expiraEm: null };
    }

    let paymentIntent: { id: string; clientSecret: string };
    try {
      paymentIntent = await this.stripe.criarPaymentIntent(
        valorCentavos,
        booking.id,
      );
    } catch (err) {
      await this.prisma.$transaction([
        this.prisma.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.CANCELADO },
        }),
        this.prisma.seat.updateMany({
          where: { bookingId: booking.id },
          data: { bookingId: null },
        }),
      ]);
      const mensagem = err instanceof Error ? err.message : String(err);
      this.logger.error(`Falha ao criar PaymentIntent no Stripe: ${mensagem}`);
      throw new InternalServerErrorException(
        'Não foi possível iniciar o pagamento. Tente novamente em instantes.',
      );
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
      include: { evento: true, sessao: true, ticketType: true, seats: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async buscarPorId(id: string, clienteId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { evento: true, sessao: true, ticketType: true, seats: true },
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
      include: { evento: true, sessao: true, ticketType: true },
    });
    if (!booking) throw new NotFoundException('Ingresso não encontrado.');
    return booking;
  }

  async cancelar(id: string, clienteId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { sessao: true },
    });
    if (!booking) throw new NotFoundException('Ingresso não encontrado.');
    if (booking.clienteId !== clienteId) {
      throw new ForbiddenException('Este ingresso não pertence a você.');
    }
    if (
      booking.status !== BookingStatus.CONFIRMADO &&
      booking.status !== BookingStatus.PENDENTE
    ) {
      throw new ConflictException('Este ingresso não pode mais ser cancelado.');
    }
    if (booking.sessao.dataHora.getTime() <= Date.now()) {
      throw new ConflictException(
        'Não é possível cancelar após o início da sessão.',
      );
    }

    if (booking.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: booking.orderId },
      });
      if (order?.stripePaymentIntentId) {
        await this.stripe.criarReembolso(
          order.stripePaymentIntentId,
          booking.valorCentavos,
        );
      }
    } else if (booking.stripePaymentIntentId) {
      await this.stripe.criarReembolso(booking.stripePaymentIntentId);
    }

    const [cancelada] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id },
        data: { status: BookingStatus.CANCELADO },
      }),
      this.prisma.seat.updateMany({
        where: { bookingId: id },
        data: { bookingId: null },
      }),
    ]);

    return cancelada;
  }
}

export type { Prisma };
