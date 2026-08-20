import {
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

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async criar(organizadorId: string, dto: CriarEventoDto) {
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
        dataInicio: new Date(dto.dataInicio),
        dataFim: new Date(dto.dataFim),
        gradiente: dto.gradiente,
        tmdbId: dto.tmdbId,
        posterUrl: dto.posterUrl,
        usaMapaAssentos: dto.usaMapaAssentos ?? false,
        organizadorId,
        status: EventStatus.RASCUNHO,
        ticketTypes: {
          create: dto.ingressos.map((t) => ({
            nome: t.nome,
            gratuito: t.gratuito,
            preco: t.preco,
            capacidade: t.capacidade,
            vendaInicio: t.vendaInicio ? new Date(t.vendaInicio) : undefined,
            vendaFim: t.vendaFim ? new Date(t.vendaFim) : undefined,
            publico: t.publico,
            descricao: t.descricao,
          })),
        },
      },
      include: { ticketTypes: true },
    });

    if (evento.usaMapaAssentos) {
      for (const ticketType of evento.ticketTypes) {
        await this.prisma.seat.createMany({
          data: codigosDeAssento().map((codigo) => ({
            ticketTypeId: ticketType.id,
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
        status: EventStatus.PUBLICADO,
        categoria: filtros.categoria,
        cidade: filtros.cidade ? { contains: filtros.cidade, mode: 'insensitive' } : undefined,
        titulo: filtros.busca ? { contains: filtros.busca, mode: 'insensitive' } : undefined,
      },
      include: { ticketTypes: true },
      orderBy: { dataInicio: 'asc' },
    });
  }

  async buscarPorId(id: string) {
    const evento = await this.prisma.event.findUnique({
      where: { id },
      include: { ticketTypes: true },
    });
    if (!evento) throw new NotFoundException('Evento não encontrado.');
    return evento;
  }

  async meusEventos(organizadorId: string) {
    return this.prisma.event.findMany({
      where: { organizadorId },
      include: { ticketTypes: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async atualizar(id: string, organizadorId: string, dto: AtualizarEventoDto) {
    const evento = await this.prisma.event.findUnique({
      where: { id },
      include: { ticketTypes: { include: { seats: true } } },
    });
    if (!evento) throw new NotFoundException('Evento não encontrado.');
    if (evento.organizadorId !== organizadorId) {
      throw new ForbiddenException('Você não é o organizador deste evento.');
    }

    const { ingressos, dataInicio, dataFim, endereco, ...resto } = dto;
    const data: Record<string, unknown> = { ...resto };
    if (dataInicio) data.dataInicio = new Date(dataInicio);
    if (dataFim) data.dataFim = new Date(dataFim);
    if (endereco) data.endereco = endereco;

    const atualizado = await this.prisma.event.update({
      where: { id },
      data,
      include: { ticketTypes: true },
    });

    const ligandoMapaAssentos = dto.usaMapaAssentos === true && !evento.usaMapaAssentos;
    if (ligandoMapaAssentos) {
      for (const ticketType of evento.ticketTypes) {
        if (ticketType.seats.length > 0) continue;
        await this.prisma.seat.createMany({
          data: codigosDeAssento().map((codigo) => ({
            ticketTypeId: ticketType.id,
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
        status: { in: [BookingStatus.PENDENTE, BookingStatus.CONFIRMADO, BookingStatus.USADO] },
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
