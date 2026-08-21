import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventStatus } from '@prisma/client';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CriarEventoDto } from './dto/criar-evento.dto';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: {
    event: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
    seat: { createMany: jest.Mock };
    sessao: { create: jest.Mock; update: jest.Mock; delete: jest.Mock };
    ticketType: { create: jest.Mock; update: jest.Mock; delete: jest.Mock };
    booking: { count: jest.Mock; aggregate: jest.Mock };
    $transaction: jest.Mock;
  };

  const ticketTypeSemRestricao = (nome: string) => ({
    nome,
    gratuito: false,
    preco: 10,
    capacidade: 10,
    publico: 'GERAL' as const,
  });

  beforeEach(async () => {
    prisma = {
      event: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      seat: { createMany: jest.fn().mockResolvedValue({ count: 80 }) },
      sessao: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      ticketType: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      booking: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantidade: 0 } }),
      },
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => unknown)(prisma)
          : Promise.all(arg as unknown[]),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [EventsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(EventsService);
  });

  it('throws NotFoundException when updating a non-existent event', async () => {
    prisma.event.findUnique.mockResolvedValue(null);

    await expect(
      service.atualizar('evento-inexistente', 'organizador-1', {
        titulo: 'Novo título',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when a different organizador tries to update', async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 'evento-1',
      organizadorId: 'dono-original',
      sessoes: [],
    });

    await expect(
      service.atualizar('evento-1', 'outro-organizador', {
        titulo: 'Novo título',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('updates the event when the requester is the owner', async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 'evento-1',
      organizadorId: 'dono-original',
      usaMapaAssentos: false,
      sessoes: [],
    });
    prisma.event.update.mockResolvedValue({
      id: 'evento-1',
      organizadorId: 'dono-original',
      titulo: 'Novo título',
      status: EventStatus.PUBLICADO,
    });

    const resultado = await service.atualizar('evento-1', 'dono-original', {
      titulo: 'Novo título',
    });

    expect(resultado.titulo).toBe('Novo título');
    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 'evento-1' },
      data: { titulo: 'Novo título' },
      include: { sessoes: { include: { ticketTypes: true } } },
    });
  });

  describe('criar', () => {
    const dtoBase: Omit<CriarEventoDto, 'sessoes'> = {
      titulo: 'Teste',
      categoria: 'cinema',
      modalidade: 'presencial',
      cidade: 'Sete Lagoas',
      gradiente: 'from-blue-500 to-blue-700',
      usaMapaAssentos: true,
    };

    it('creates one set of 80 seats per sessão, not per ticketType', async () => {
      prisma.event.create.mockResolvedValue({
        id: 'evento-1',
        usaMapaAssentos: true,
        sessoes: [
          {
            id: 'sessao-1',
            ticketTypes: [{ id: 'ticket-1' }, { id: 'ticket-2' }],
          },
        ],
      });

      await service.criar('organizador-1', {
        ...dtoBase,
        sessoes: [
          {
            dataHora: new Date().toISOString(),
            ingressos: [
              ticketTypeSemRestricao('Inteira'),
              ticketTypeSemRestricao('Meia'),
            ],
          },
        ],
      });

      expect(prisma.seat.createMany).toHaveBeenCalledTimes(1);
      const chamada = prisma.seat.createMany.mock.calls[0] as [
        { data: { sessaoId: string; codigo: string }[] },
      ];
      const dataArg = chamada[0].data;
      expect(dataArg).toHaveLength(80);
      expect(dataArg[0]).toMatchObject({ sessaoId: 'sessao-1', codigo: 'A1' });
    });

    it('rejects two ticketTypes of the same sessão with overlapping fileiras', async () => {
      await expect(
        service.criar('organizador-1', {
          ...dtoBase,
          sessoes: [
            {
              dataHora: new Date().toISOString(),
              ingressos: [
                {
                  ...ticketTypeSemRestricao('Inteira'),
                  fileiraInicio: 'A',
                  fileiraFim: 'E',
                },
                {
                  ...ticketTypeSemRestricao('VIP'),
                  fileiraInicio: 'C',
                  fileiraFim: 'H',
                },
              ],
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it('accepts ticketTypes with non-overlapping fileiras', async () => {
      prisma.event.create.mockResolvedValue({
        id: 'evento-1',
        usaMapaAssentos: true,
        sessoes: [
          {
            id: 'sessao-1',
            ticketTypes: [{ id: 'ticket-1' }, { id: 'ticket-2' }],
          },
        ],
      });

      await expect(
        service.criar('organizador-1', {
          ...dtoBase,
          sessoes: [
            {
              dataHora: new Date().toISOString(),
              ingressos: [
                {
                  ...ticketTypeSemRestricao('VIP'),
                  fileiraInicio: 'A',
                  fileiraFim: 'D',
                },
                {
                  ...ticketTypeSemRestricao('Inteira'),
                  fileiraInicio: 'E',
                  fileiraFim: 'H',
                },
              ],
            },
          ],
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('atualizar — sincronização de sessões', () => {
    it('does not touch existing sessões when dto.sessoes is not sent (regression)', async () => {
      const sessaoExistente = {
        id: 'sessao-1',
        dataHora: new Date(),
        sala: null,
        seats: [],
        ticketTypes: [
          {
            id: 'ticket-1',
            nome: 'Pista',
            capacidade: 80,
            fileiraInicio: null,
            fileiraFim: null,
          },
        ],
      };
      prisma.event.findUnique.mockResolvedValue({
        id: 'evento-1',
        organizadorId: 'dono-1',
        usaMapaAssentos: false,
        sessoes: [sessaoExistente],
      });
      prisma.event.update.mockResolvedValue({
        id: 'evento-1',
        titulo: 'Novo título',
      });

      await service.atualizar('evento-1', 'dono-1', { titulo: 'Novo título' });

      expect(prisma.sessao.delete).not.toHaveBeenCalled();
      expect(prisma.sessao.update).not.toHaveBeenCalled();
      expect(prisma.sessao.create).not.toHaveBeenCalled();
      expect(prisma.ticketType.delete).not.toHaveBeenCalled();
    });

    it('creates a new sessão with a new ticketType when its id is not in the database', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'evento-1',
        organizadorId: 'dono-1',
        usaMapaAssentos: false,
        sessoes: [],
      });
      prisma.event.update.mockResolvedValue({ id: 'evento-1' });
      prisma.sessao.create.mockResolvedValue({ id: 'sessao-nova' });

      await service.atualizar('evento-1', 'dono-1', {
        sessoes: [
          {
            id: 'sessao-client-side-uuid',
            dataHora: new Date().toISOString(),
            ingressos: [
              {
                id: 'ticket-client-side-uuid',
                nome: 'Inteira',
                gratuito: false,
                preco: 50,
                capacidade: 100,
                publico: 'GERAL',
              },
            ],
          },
        ],
      } as never);

      expect(prisma.sessao.create).toHaveBeenCalledTimes(1);
    });

    it('recalculates dataInicio/dataFim from the payload sessões when editing dates', async () => {
      const sessaoExistente = {
        id: 'sessao-1',
        dataHora: new Date('2026-01-10T20:00:00Z'),
        sala: null,
        seats: [],
        ticketTypes: [],
      };
      prisma.event.findUnique.mockResolvedValue({
        id: 'evento-1',
        organizadorId: 'dono-1',
        usaMapaAssentos: false,
        sessoes: [sessaoExistente],
      });
      prisma.event.update.mockResolvedValue({ id: 'evento-1' });

      await service.atualizar('evento-1', 'dono-1', {
        sessoes: [
          {
            id: 'sessao-1',
            dataHora: '2026-03-22T22:00:00.000Z',
            ingressos: [],
          },
        ],
      });

      const chamada = prisma.event.update.mock.calls[0] as [
        { data: { dataInicio?: Date; dataFim?: Date } },
      ];
      expect(chamada[0].data.dataInicio).toEqual(
        new Date('2026-03-22T22:00:00.000Z'),
      );
      expect(chamada[0].data.dataFim).toEqual(
        new Date('2026-03-22T22:00:00.000Z'),
      );
    });

    it('does not touch dataInicio/dataFim when dto.sessoes is not sent', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'evento-1',
        organizadorId: 'dono-1',
        usaMapaAssentos: false,
        sessoes: [],
      });
      prisma.event.update.mockResolvedValue({ id: 'evento-1' });

      await service.atualizar('evento-1', 'dono-1', { titulo: 'Novo título' });

      const chamada = prisma.event.update.mock.calls[0] as [
        { data: { dataInicio?: Date; dataFim?: Date } },
      ];
      expect(chamada[0].data).not.toHaveProperty('dataInicio');
      expect(chamada[0].data).not.toHaveProperty('dataFim');
    });

    it('updates an existing ticketType price/capacidade when it already has sales', async () => {
      const sessaoExistente = {
        id: 'sessao-1',
        dataHora: new Date(),
        sala: null,
        seats: [],
        ticketTypes: [
          {
            id: 'ticket-1',
            nome: 'Pista',
            capacidade: 80,
            fileiraInicio: null,
            fileiraFim: null,
          },
        ],
      };
      prisma.event.findUnique.mockResolvedValue({
        id: 'evento-1',
        organizadorId: 'dono-1',
        usaMapaAssentos: false,
        sessoes: [sessaoExistente],
      });
      prisma.event.update.mockResolvedValue({ id: 'evento-1' });
      prisma.booking.aggregate.mockResolvedValue({ _sum: { quantidade: 20 } });

      await service.atualizar('evento-1', 'dono-1', {
        sessoes: [
          {
            id: 'sessao-1',
            dataHora: sessaoExistente.dataHora.toISOString(),
            ingressos: [
              {
                id: 'ticket-1',
                nome: 'Pista',
                gratuito: false,
                preco: 60,
                capacidade: 100,
                publico: 'GERAL',
              },
            ],
          },
        ],
      } as never);

      expect(prisma.ticketType.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ticket-1' } }),
      );
    });

    it('rejects reducing capacidade below the quantity already sold', async () => {
      const sessaoExistente = {
        id: 'sessao-1',
        dataHora: new Date(),
        sala: null,
        seats: [],
        ticketTypes: [
          {
            id: 'ticket-1',
            nome: 'Pista',
            capacidade: 80,
            fileiraInicio: null,
            fileiraFim: null,
          },
        ],
      };
      prisma.event.findUnique.mockResolvedValue({
        id: 'evento-1',
        organizadorId: 'dono-1',
        usaMapaAssentos: false,
        sessoes: [sessaoExistente],
      });
      prisma.booking.aggregate.mockResolvedValue({ _sum: { quantidade: 20 } });

      await expect(
        service.atualizar('evento-1', 'dono-1', {
          sessoes: [
            {
              id: 'sessao-1',
              dataHora: sessaoExistente.dataHora.toISOString(),
              ingressos: [
                {
                  id: 'ticket-1',
                  nome: 'Pista',
                  gratuito: false,
                  preco: 50,
                  capacidade: 10,
                  publico: 'GERAL',
                },
              ],
            },
          ],
        } as never),
      ).rejects.toThrow(ConflictException);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('removes a sessão with no bookings when absent from the payload', async () => {
      const sessaoSemVendas = {
        id: 'sessao-1',
        dataHora: new Date(),
        sala: null,
        seats: [],
        ticketTypes: [],
      };
      prisma.event.findUnique.mockResolvedValue({
        id: 'evento-1',
        organizadorId: 'dono-1',
        usaMapaAssentos: false,
        sessoes: [sessaoSemVendas],
      });
      prisma.event.update.mockResolvedValue({ id: 'evento-1' });
      prisma.booking.count.mockResolvedValue(0);

      await service.atualizar('evento-1', 'dono-1', { sessoes: [] });

      expect(prisma.sessao.delete).toHaveBeenCalledWith({
        where: { id: 'sessao-1' },
      });
    });

    it('keeps a sessão with bookings silently when absent from the payload', async () => {
      const sessaoComVendas = {
        id: 'sessao-1',
        dataHora: new Date(),
        sala: null,
        seats: [],
        ticketTypes: [],
      };
      prisma.event.findUnique.mockResolvedValue({
        id: 'evento-1',
        organizadorId: 'dono-1',
        usaMapaAssentos: false,
        sessoes: [sessaoComVendas],
      });
      prisma.event.update.mockResolvedValue({ id: 'evento-1' });
      prisma.booking.count.mockResolvedValue(2);

      await expect(
        service.atualizar('evento-1', 'dono-1', { sessoes: [] }),
      ).resolves.toBeDefined();
      expect(prisma.sessao.delete).not.toHaveBeenCalled();
    });

    it('generates Seats for a new sessão when the event already uses seat maps', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'evento-1',
        organizadorId: 'dono-1',
        usaMapaAssentos: true,
        sessoes: [],
      });
      prisma.event.update.mockResolvedValue({ id: 'evento-1' });
      prisma.sessao.create.mockResolvedValue({ id: 'sessao-nova' });

      await service.atualizar('evento-1', 'dono-1', {
        sessoes: [
          {
            id: 'sessao-client-side-uuid',
            dataHora: new Date().toISOString(),
            ingressos: [
              {
                id: 'ticket-client-side-uuid',
                ...ticketTypeSemRestricao('Inteira'),
              },
            ],
          },
        ],
      });

      const chamada = prisma.seat.createMany.mock.calls[0] as [
        { data: { sessaoId: string; codigo: string }[] },
      ];
      expect(chamada[0].data[0]).toMatchObject({
        sessaoId: 'sessao-nova',
        codigo: 'A1',
      });
    });
  });
});
