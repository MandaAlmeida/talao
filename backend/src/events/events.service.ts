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

    if (dto.sessoes) {
      for (const sessao of dto.sessoes) {
        validarFileirasSemSobreposicao(sessao.ingressos);
      }
    }

    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      sessoes: _sessoes,
      endereco,
      ...resto
    } = dto;
    const data: Record<string, unknown> = { ...resto };
    if (endereco) data.endereco = endereco;

    const atualizado = await this.prisma.event.update({
      where: { id },
      data,
      include: { sessoes: { include: { ticketTypes: true } } },
    });

    const ligandoMapaAssentos =
      dto.usaMapaAssentos === true && !evento.usaMapaAssentos;
    if (ligandoMapaAssentos) {
      for (const sessao of evento.sessoes) {
        if (sessao.seats.length > 0) continue;
        await this.prisma.seat.createMany({
          data: codigosDeAssento().map((codigo) => ({
            sessaoId: sessao.id,
            codigo,
          })),
        });
      }
    }

    return atualizado;
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
