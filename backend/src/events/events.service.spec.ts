import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventStatus } from '@prisma/client';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: {
    event: { findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      event: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
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
      include: { ticketTypes: true },
    });
  });
});
