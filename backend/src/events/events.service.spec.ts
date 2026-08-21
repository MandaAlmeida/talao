import { Test } from '@nestjs/testing';
import {
  BadRequestException,
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
});
