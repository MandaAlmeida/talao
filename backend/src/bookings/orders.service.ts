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
import {
  BookingStatus,
  EventStatus,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../payments/stripe.service';
import { CriarOrderDto } from './dto/criar-order.dto';
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
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private stripe: StripeService,
  ) {}

  async criar(clienteId: string, sessaoId: string, dto: CriarOrderDto) {
    const secret = this.config.get<string>('QR_SECRET')!;

    const ticketTypeIds = dto.itens.map((i) => i.ticketTypeId);
    if (new Set(ticketTypeIds).size !== ticketTypeIds.length) {
      throw new BadRequestException(
        'Não é possível repetir o mesmo tipo de ingresso no pedido — ajuste a quantidade do item existente.',
      );
    }

    const { order, bookingIds, valorTotalCentavos } =
      await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            clienteId,
            eventoId: '',
            sessaoId,
            valorTotalCentavos: 0,
          },
        });

        let eventoId = '';
        let valorTotalCentavos = 0;
        const bookingIds: string[] = [];

        for (const item of dto.itens) {
          const ticketType = await tx.ticketType.findUnique({
            where: { id: item.ticketTypeId },
            include: { sessao: { include: { evento: true } } },
          });

          if (!ticketType || ticketType.sessao.id !== sessaoId) {
            throw new NotFoundException(
              `Tipo de ingresso ${item.ticketTypeId} não encontrado para esta sessão.`,
            );
          }

          const evento = ticketType.sessao.evento;
          eventoId = evento.id;

          if (
            evento.status === EventStatus.RASCUNHO ||
            evento.status === EventStatus.EM_BREVE
          ) {
            throw new ConflictException(
              'Este evento ainda não está com as vendas abertas.',
            );
          }

          const usaAssentos = evento.usaMapaAssentos;

          if (usaAssentos) {
            if (!item.assentos || item.assentos.length !== item.quantidade) {
              throw new BadRequestException(
                `Selecione exatamente ${item.quantidade} assento(s) para o item "${ticketType.nome}".`,
              );
            }

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
              const donos = restritores.filter((t) => {
                const ini = FILEIRAS.indexOf(t.fileiraInicio!);
                const fim = FILEIRAS.indexOf(t.fileiraFim!);
                const idx = FILEIRAS.indexOf(fileira);
                return idx >= ini && idx <= fim;
              });
              return (
                donos.length === 0 || donos.some((d) => d.id === ticketType.id)
              );
            };

            const foraDeAlcance = item.assentos.filter(
              (c) => !assentoPermitido(c),
            );
            if (foraDeAlcance.length > 0) {
              throw new ConflictException(
                `Assento(s) ${foraDeAlcance.join(', ')} não disponível(is) para "${ticketType.nome}".`,
              );
            }

            const assentos = await tx.seat.findMany({
              where: {
                sessaoId,
                codigo: { in: item.assentos },
              },
            });

            if (assentos.length !== item.assentos.length) {
              throw new NotFoundException(
                'Um ou mais assentos informados não existem.',
              );
            }
            if (assentos.some((a) => a.bookingId !== null)) {
              throw new ConflictException(
                'Um ou mais assentos selecionados já foram reservados.',
              );
            }
          } else {
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

            if (item.quantidade > disponivel) {
              throw new ConflictException(
                `Apenas ${disponivel} ingresso(s) disponível(is) para "${ticketType.nome}".`,
              );
            }
          }

          const codigoCompra = gerarCodigoCompra();
          const qrAssinatura = assinarCodigo(codigoCompra, secret);
          const valorCentavos = calcularValorCentavos(
            ticketType.preco,
            item.quantidade,
            ticketType.gratuito,
          );
          valorTotalCentavos += valorCentavos;

          const novaBooking = await tx.booking.create({
            data: {
              orderId: order.id,
              eventoId: evento.id,
              sessaoId,
              ticketTypeId: ticketType.id,
              clienteId,
              quantidade: item.quantidade,
              valorCentavos,
              status: BookingStatus.PENDENTE,
              codigoCompra,
              qrAssinatura,
              expiraEm: new Date(Date.now() + 10 * 60_000),
            },
          });
          bookingIds.push(novaBooking.id);

          if (usaAssentos && item.assentos) {
            await tx.seat.updateMany({
              where: {
                sessaoId,
                codigo: { in: item.assentos },
              },
              data: { bookingId: novaBooking.id },
            });
          }
        }

        const gratis = valorTotalCentavos === 0;
        await tx.order.update({
          where: { id: order.id },
          data: {
            eventoId,
            valorTotalCentavos,
            status: gratis ? OrderStatus.CONFIRMADO : OrderStatus.PENDENTE,
          },
        });
        if (gratis) {
          await tx.booking.updateMany({
            where: { id: { in: bookingIds } },
            data: { status: BookingStatus.CONFIRMADO, expiraEm: null },
          });
        }

        return { order, bookingIds, valorTotalCentavos };
      });

    if (valorTotalCentavos === 0) {
      return {
        orderId: order.id,
        clientSecret: null,
        expiraEm: null,
        bookingIds,
      };
    }

    let paymentIntent: { id: string; clientSecret: string };
    try {
      paymentIntent = await this.stripe.criarPaymentIntent(
        valorTotalCentavos,
        order.id,
      );
    } catch (err) {
      await this.prisma.$transaction([
        this.prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.CANCELADO },
        }),
        this.prisma.booking.updateMany({
          where: { orderId: order.id },
          data: { status: BookingStatus.CANCELADO },
        }),
        this.prisma.seat.updateMany({
          where: { bookingId: { in: bookingIds } },
          data: { bookingId: null },
        }),
      ]);
      const mensagem = err instanceof Error ? err.message : String(err);
      this.logger.error(`Falha ao criar PaymentIntent no Stripe: ${mensagem}`);
      throw new InternalServerErrorException(
        'Não foi possível iniciar o pagamento. Tente novamente em instantes.',
      );
    }

    const atualizada = await this.prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    return {
      orderId: atualizada.id,
      clientSecret: paymentIntent.clientSecret,
      expiraEm: new Date(Date.now() + 10 * 60_000).toISOString(),
      bookingIds,
    };
  }

  async buscarPorId(id: string, clienteId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { bookings: { include: { ticketType: true, seats: true } } },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    if (order.clienteId !== clienteId) {
      throw new ForbiddenException('Este pedido não pertence a você.');
    }
    return order;
  }
}
