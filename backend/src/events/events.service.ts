import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, EventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CriarEventoDto } from './dto/criar-evento.dto';
import { AtualizarEventoDto } from './dto/atualizar-evento.dto';
import { ListarEventosDto } from './dto/listar-eventos.dto';

const FILEIRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const ASSENTOS_POR_FILEIRA = 10;

function codigosDeAssento(): string[] {
  const codigos: string[] = [];
  for (const fileira of FILEIRAS) {
    for (let i = 1; i <= ASSENTOS_POR_FILEIRA; i++) {
      codigos.push(`${fileira}${i}`);
    }
  }
  return codigos;
}

function fileiraIndex(fileira: string): number {
  return FILEIRAS.indexOf(fileira);
}

function intervalosSeSobrepoe(
  a: { fileiraInicio?: string | null; fileiraFim?: string | null },
  b: { fileiraInicio?: string | null; fileiraFim?: string | null },
): boolean {
  const aIni = fileiraIndex(a.fileiraInicio!);
  const aFim = fileiraIndex(a.fileiraFim!);
  const bIni = fileiraIndex(b.fileiraInicio!);
  const bFim = fileiraIndex(b.fileiraFim!);
  return aIni <= bFim && bIni <= aFim;
}

function validarFileirasSemSobreposicao(
  ticketTypes: {
    nome: string;
    fileiraInicio?: string | null;
    fileiraFim?: string | null;
  }[],
): void {
  const restritos = ticketTypes.filter((t) => t.fileiraInicio && t.fileiraFim);
  for (let i = 0; i < restritos.length; i++) {
    for (let j = i + 1; j < restritos.length; j++) {
      if (intervalosSeSobrepoe(restritos[i], restritos[j])) {
        throw new BadRequestException(
          `Os tipos de ingresso "${restritos[i].nome}" e "${restritos[j].nome}" têm fileiras sobrepostas.`,
        );
      }
    }
  }
}

// A "janela" do evento (dataInicio/dataFim) é derivada das sessões — a mais
// cedo e a mais tarde — em vez de informada manualmente pelo organizador.
function calcularJanela(sessoes: { dataHora: string }[]) {
  const datas = sessoes.map((s) => new Date(s.dataHora).getTime());
  return {
    dataInicio: new Date(Math.min(...datas)),
    dataFim: new Date(Math.max(...datas)),
  };
}

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async criar(organizadorId: string, dto: CriarEventoDto) {
    for (const sessao of dto.sessoes) {
      validarFileirasSemSobreposicao(sessao.ingressos);
    }

    const { dataInicio, dataFim } = calcularJanela(dto.sessoes);

    const evento = await this.prisma.event.create({
      data: {
        titulo: dto.titulo,
        categoria: dto.categoria,
        assunto: dto.assunto,
        descricaoCompleta: dto.descricaoCompleta,
        modalidade: dto.modalidade,
        cidade: dto.cidade,
        endereco: dto.endereco as unknown as Prisma.InputJsonValue,
        linkAcesso: dto.linkAcesso,
        dataInicio,
        dataFim,
        gradiente: dto.gradiente,
        tmdbId: dto.tmdbId,
        posterUrl: dto.posterUrl,
        usaMapaAssentos: dto.usaMapaAssentos ?? false,
        organizadorId,
        status: EventStatus.RASCUNHO,
        sessoes: {
          create: dto.sessoes.map((s) => ({
            dataHora: new Date(s.dataHora),
            sala: s.sala,
            ticketTypes: {
              create: s.ingressos.map((t) => ({
                nome: t.nome,
                gratuito: t.gratuito,
                preco: t.preco,
                capacidade: t.capacidade,
                vendaInicio: t.vendaInicio
                  ? new Date(t.vendaInicio)
                  : undefined,
                vendaFim: t.vendaFim ? new Date(t.vendaFim) : undefined,
                publico: t.publico,
                descricao: t.descricao,
                fileiraInicio: t.fileiraInicio,
                fileiraFim: t.fileiraFim,
              })),
            },
          })),
        },
      },
      include: { sessoes: { include: { ticketTypes: true } } },
    });

    if (evento.usaMapaAssentos) {
      for (const sessao of evento.sessoes) {
        await this.prisma.seat.createMany({
          data: codigosDeAssento().map((codigo) => ({
            sessaoId: sessao.id,
            codigo,
          })),
        });
      }
    }

    return evento;
  }

  async listar(filtros: ListarEventosDto) {
    return this.prisma.event.findMany({
      where: {
        status:
          filtros.status === 'em-breve'
            ? EventStatus.EM_BREVE
            : { in: [EventStatus.PUBLICADO, EventStatus.PRE_VENDA] },
        categoria: filtros.categoria,
        cidade: filtros.cidade
          ? { contains: filtros.cidade, mode: 'insensitive' }
          : undefined,
        titulo: filtros.busca
          ? { contains: filtros.busca, mode: 'insensitive' }
          : undefined,
      },
      include: {
        sessoes: {
          include: { ticketTypes: true },
          orderBy: { dataHora: 'asc' },
        },
      },
      orderBy: { dataInicio: 'asc' },
    });
  }

  async buscarPorId(id: string) {
    const evento = await this.prisma.event.findUnique({
      where: { id },
      include: {
        sessoes: {
          include: { ticketTypes: true },
          orderBy: { dataHora: 'asc' },
        },
      },
    });
    if (!evento) throw new NotFoundException('Evento não encontrado.');
    return evento;
  }

  async meusEventos(organizadorId: string) {
    const eventos = await this.prisma.event.findMany({
      where: { organizadorId },
      include: {
        sessoes: {
          include: {
            ticketTypes: {
              include: {
                bookings: {
                  where: {
                    status: {
                      in: [BookingStatus.CONFIRMADO, BookingStatus.USADO],
                    },
                  },
                  select: { quantidade: true },
                },
              },
            },
          },
          orderBy: { dataHora: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return eventos.map((evento) => {
      const sessoes = evento.sessoes.map((sessao) => {
        const ticketTypes = sessao.ticketTypes.map((tt) => {
          const vendidos = tt.bookings.reduce(
            (total, b) => total + b.quantidade,
            0,
          );
          const {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            bookings: _bookings,
            ...ticketType
          } = tt;
          return { ...ticketType, vendidos };
        });
        return { ...sessao, ticketTypes };
      });

      const todosTicketTypes = sessoes.flatMap((s) => s.ticketTypes);
      const totalVendidos = todosTicketTypes.reduce(
        (total, tt) => total + tt.vendidos,
        0,
      );
      const totalCapacidade = todosTicketTypes.reduce(
        (total, tt) => total + tt.capacidade,
        0,
      );
      const receitaTotal = todosTicketTypes.reduce(
        (total, tt) =>
          total + (tt.gratuito ? 0 : Number(tt.preco) * tt.vendidos),
        0,
      );

      return {
        ...evento,
        sessoes,
        totalVendidos,
        totalCapacidade,
        receitaTotal,
      };
    });
  }

  async atualizar(id: string, organizadorId: string, dto: AtualizarEventoDto) {
    const evento = await this.prisma.event.findUnique({
      where: { id },
      include: {
        sessoes: { include: { ticketTypes: true, seats: true } },
      },
    });
    if (!evento) throw new NotFoundException('Evento não encontrado.');
    if (evento.organizadorId !== organizadorId) {
      throw new ForbiddenException('Você não é o organizador deste evento.');
    }

    const { sessoes: sessoesPayload, endereco, ...resto } = dto;
    const data: Record<string, unknown> = { ...resto };
    if (endereco) data.endereco = endereco;

    const usaMapaAssentosFinal = dto.usaMapaAssentos ?? evento.usaMapaAssentos;

    const ligandoMapaAssentos =
      dto.usaMapaAssentos === true && !evento.usaMapaAssentos;

    const atualizado = await this.prisma.$transaction(async (tx) => {
      if (sessoesPayload) {
        await this.sincronizarSessoes(
          tx,
          evento,
          sessoesPayload,
          usaMapaAssentosFinal,
        );
      }

      if (ligandoMapaAssentos) {
        for (const sessao of evento.sessoes) {
          if (sessao.seats.length > 0) continue;
          await tx.seat.createMany({
            data: codigosDeAssento().map((codigo) => ({
              sessaoId: sessao.id,
              codigo,
            })),
          });
        }
      }

      return tx.event.update({
        where: { id },
        data,
        include: { sessoes: { include: { ticketTypes: true } } },
      });
    });

    return atualizado;
  }

  private async sincronizarSessoes(
    tx: Prisma.TransactionClient,
    evento: {
      id: string;
      sessoes: {
        id: string;
        seats: { id: string }[];
        ticketTypes: {
          id: string;
          nome: string;
          fileiraInicio: string | null;
          fileiraFim: string | null;
        }[];
      }[];
    },
    sessoesPayload: NonNullable<AtualizarEventoDto['sessoes']>,
    usaMapaAssentos: boolean,
  ) {
    const sessaoIdsNoPayload = new Set(
      sessoesPayload.map((s) => s.id).filter((v): v is string => !!v),
    );

    // Sessões existentes ausentes do payload: remove se sem vendas.
    for (const sessaoExistente of evento.sessoes) {
      if (sessaoIdsNoPayload.has(sessaoExistente.id)) continue;
      const totalReservas = await tx.booking.count({
        where: { sessaoId: sessaoExistente.id },
      });
      if (totalReservas === 0) {
        await tx.sessao.delete({ where: { id: sessaoExistente.id } });
      }
    }

    for (const sessaoDto of sessoesPayload) {
      const sessaoExistente = evento.sessoes.find((s) => s.id === sessaoDto.id);

      const ticketTypeIdsNoPayload = new Set(
        sessaoDto.ingressos.map((t) => t.id).filter((v): v is string => !!v),
      );

      const ticketTypesMantidos: {
        nome: string;
        fileiraInicio: string | null;
        fileiraFim: string | null;
      }[] = [];
      if (sessaoExistente) {
        for (const ticketExistente of sessaoExistente.ticketTypes) {
          if (ticketTypeIdsNoPayload.has(ticketExistente.id)) continue;
          const totalReservas = await tx.booking.count({
            where: { ticketTypeId: ticketExistente.id },
          });
          if (totalReservas === 0) {
            await tx.ticketType.delete({ where: { id: ticketExistente.id } });
          } else {
            ticketTypesMantidos.push(ticketExistente);
          }
        }
      }

      for (const ticketDto of sessaoDto.ingressos) {
        if (!ticketDto.id) continue;
        const existeNoBanco = sessaoExistente?.ticketTypes.some(
          (t) => t.id === ticketDto.id,
        );
        if (!existeNoBanco) continue;

        const agregado = await tx.booking.aggregate({
          where: {
            ticketTypeId: ticketDto.id,
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
        if (ticketDto.capacidade < vendidos) {
          throw new ConflictException(
            `Não é possível reduzir a capacidade de "${ticketDto.nome}" abaixo de ${vendidos} ingresso(s) já vendido(s).`,
          );
        }
      }

      validarFileirasSemSobreposicao([
        ...sessaoDto.ingressos,
        ...ticketTypesMantidos,
      ]);

      if (sessaoExistente) {
        await tx.sessao.update({
          where: { id: sessaoExistente.id },
          data: {
            dataHora: new Date(sessaoDto.dataHora),
            sala: sessaoDto.sala,
          },
        });

        for (const ticketDto of sessaoDto.ingressos) {
          const dadosTicket = {
            nome: ticketDto.nome,
            gratuito: ticketDto.gratuito,
            preco: ticketDto.preco,
            capacidade: ticketDto.capacidade,
            vendaInicio: ticketDto.vendaInicio
              ? new Date(ticketDto.vendaInicio)
              : undefined,
            vendaFim: ticketDto.vendaFim
              ? new Date(ticketDto.vendaFim)
              : undefined,
            publico: ticketDto.publico,
            descricao: ticketDto.descricao,
            fileiraInicio: ticketDto.fileiraInicio,
            fileiraFim: ticketDto.fileiraFim,
          };

          const ticketExisteNoBanco =
            ticketDto.id &&
            sessaoExistente.ticketTypes.some((t) => t.id === ticketDto.id);

          if (ticketExisteNoBanco) {
            await tx.ticketType.update({
              where: { id: ticketDto.id },
              data: dadosTicket,
            });
          } else {
            await tx.ticketType.create({
              data: { ...dadosTicket, sessaoId: sessaoExistente.id },
            });
          }
        }
      } else {
        const novaSessao = await tx.sessao.create({
          data: {
            eventoId: evento.id,
            dataHora: new Date(sessaoDto.dataHora),
            sala: sessaoDto.sala,
            ticketTypes: {
              create: sessaoDto.ingressos.map((t) => ({
                nome: t.nome,
                gratuito: t.gratuito,
                preco: t.preco,
                capacidade: t.capacidade,
                vendaInicio: t.vendaInicio
                  ? new Date(t.vendaInicio)
                  : undefined,
                vendaFim: t.vendaFim ? new Date(t.vendaFim) : undefined,
                publico: t.publico,
                descricao: t.descricao,
                fileiraInicio: t.fileiraInicio,
                fileiraFim: t.fileiraFim,
              })),
            },
          },
        });

        if (usaMapaAssentos) {
          await tx.seat.createMany({
            data: codigosDeAssento().map((codigo) => ({
              sessaoId: novaSessao.id,
              codigo,
            })),
          });
        }
      }
    }
  }

  async cancelar(id: string, organizadorId: string) {
    const evento = await this.prisma.event.findUnique({ where: { id } });
    if (!evento) throw new NotFoundException('Evento não encontrado.');
    if (evento.organizadorId !== organizadorId) {
      throw new ForbiddenException('Você não é o organizador deste evento.');
    }

    return this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.RASCUNHO },
    });
  }

  async excluir(id: string, organizadorId: string) {
    const evento = await this.prisma.event.findUnique({ where: { id } });
    if (!evento) throw new NotFoundException('Evento não encontrado.');
    if (evento.organizadorId !== organizadorId) {
      throw new ForbiddenException('Você não é o organizador deste evento.');
    }

    const totalReservas = await this.prisma.booking.count({
      where: {
        eventoId: id,
        status: {
          in: [
            BookingStatus.PENDENTE,
            BookingStatus.CONFIRMADO,
            BookingStatus.USADO,
          ],
        },
      },
    });
    if (totalReservas > 0) {
      throw new ConflictException(
        `Não é possível excluir: há ${totalReservas} ingresso(s) vendido(s) para este evento.`,
      );
    }

    await this.prisma.event.delete({ where: { id } });
  }
}
