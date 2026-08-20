import { Test } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
  let jwt: { sign: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    jwt = { sign: jest.fn().mockReturnValue('signed-token') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('rejects registration when email already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(
      service.registrar({
        nome: 'Ana',
        email: 'ana@talao.dev',
        senha: 'senha123',
        papel: Role.CLIENTE,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('registers a new user and returns an access token', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'new-user',
      nome: 'Ana',
      email: 'ana@talao.dev',
      papel: Role.CLIENTE,
    });

    const result = await service.registrar({
      nome: 'Ana',
      email: 'ana@talao.dev',
      senha: 'senha123',
      papel: Role.CLIENTE,
    });

    expect(result.accessToken).toBe('signed-token');
    expect(result.usuario).toEqual({
      id: 'new-user',
      nome: 'Ana',
      email: 'ana@talao.dev',
      papel: Role.CLIENTE,
    });
  });

  it('rejects login with wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'existing-user',
      nome: 'Ana',
      email: 'ana@talao.dev',
      papel: Role.CLIENTE,
      senhaHash: await service.hashSenha('senha-correta'),
    });

    await expect(
      service.login({ email: 'ana@talao.dev', senha: 'senha-errada' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
