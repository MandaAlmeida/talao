import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

type RespostaAuth = { accessToken: string };
type RespostaEvento = {
  id: string;
  sessoes: { id: string; ticketTypes: { id: string }[] }[];
};
type RespostaReserva = { bookingId: string; clientSecret: string | null };
type RespostaBooking = { id: string; codigoCompra: string };
type RespostaValidacao = { situacao: string };

// Cobre o fluxo crítico ponta a ponta: registro, login, criação de evento,
// reserva de um ingresso gratuito (sem tocar o Stripe real), validação na
// portaria e cancelamento — usando um banco Postgres real via Prisma.
//
// Pré-requisito: Postgres rodando com as migrations aplicadas (ver README).
// Todos os dados criados (usuários com e-mail terminando em `-{sufixo}@e2e.dev`,
// e eventos/tickets/bookings derivados deles) são removidos no afterAll —
// nenhum teste deixa dado persistente no banco.
describe('Fluxo completo: registro → evento → reserva → portaria → cancelamento (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  const sufixo = Date.now();
  const emailSufixo = `-${sufixo}@e2e.dev`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = new PrismaClient();
  });

  afterAll(async () => {
    // Limpa tudo o que este teste criou, na ordem que respeita as FKs
    // (Booking referencia Event/TicketType/User; TicketType→Seat é cascade).
    const usuarios = await prisma.user.findMany({
      where: { email: { contains: emailSufixo } },
      select: { id: true },
    });
    const usuarioIds = usuarios.map((u) => u.id);

    const eventos = await prisma.event.findMany({
      where: { organizadorId: { in: usuarioIds } },
      select: { id: true },
    });
    const eventoIds = eventos.map((e) => e.id);

    const sessoes = await prisma.sessao.findMany({
      where: { eventoId: { in: eventoIds } },
      select: { id: true },
    });
    const sessaoIds = sessoes.map((s) => s.id);

    await prisma.booking.deleteMany({
      where: {
        OR: [
          { eventoId: { in: eventoIds } },
          { clienteId: { in: usuarioIds } },
        ],
      },
    });
    await prisma.ticketType.deleteMany({
      where: { sessaoId: { in: sessaoIds } },
    });
    await prisma.sessao.deleteMany({ where: { id: { in: sessaoIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventoIds } } });
    await prisma.user.deleteMany({ where: { id: { in: usuarioIds } } });

    await prisma.$disconnect();
    await app.close();
  });

  const registrar = (
    papel: 'ORGANIZADOR' | 'CLIENTE' | 'PORTARIA',
    prefixo: string,
  ) =>
    request(app.getHttpServer())
      .post('/auth/registro')
      .send({
        nome: `${prefixo} E2E`,
        email: `${prefixo}-${sufixo}@e2e.dev`,
        senha: 'senha123',
        papel,
      });

  it('percorre o fluxo completo de ponta a ponta', async () => {
    // 1. Registra organizador, cliente e portaria
    const organizador = await registrar('ORGANIZADOR', 'organizador').expect(
      201,
    );
    const cliente = await registrar('CLIENTE', 'cliente').expect(201);
    const portaria = await registrar('PORTARIA', 'portaria').expect(201);

    const tokenOrganizador = (organizador.body as RespostaAuth).accessToken;
    const tokenCliente = (cliente.body as RespostaAuth).accessToken;
    const tokenPortaria = (portaria.body as RespostaAuth).accessToken;
    expect(tokenOrganizador).toBeTruthy();
    expect(tokenCliente).toBeTruthy();
    expect(tokenPortaria).toBeTruthy();

    // 2. Login funciona com as credenciais recém-criadas
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `cliente-${sufixo}@e2e.dev`, senha: 'senha123' })
      .expect(201);

    // 3. Login com senha errada é rejeitado
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `cliente-${sufixo}@e2e.dev`, senha: 'senha-errada' })
      .expect(401);

    // 4. Organizador cria um evento com uma sessão e um ingresso gratuito
    const evento = await request(app.getHttpServer())
      .post('/events')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .send({
        titulo: 'Evento E2E',
        categoria: 'workshop',
        modalidade: 'online',
        cidade: 'Online',
        gradiente: 'from-blue-700 via-blue-600 to-blue-500',
        sessoes: [
          {
            dataHora: new Date(Date.now() + 48 * 60 * 60_000).toISOString(),
            ingressos: [
              {
                nome: 'Entrada',
                gratuito: true,
                preco: 0,
                capacidade: 5,
                publico: 'GERAL',
              },
            ],
          },
        ],
      })
      .expect(201);

    const { id: eventoId, sessoes } = evento.body as RespostaEvento;
    const sessaoId = sessoes[0].id;
    const ticketTypeId = sessoes[0].ticketTypes[0].id;

    // 5. Cliente não vê o evento em RASCUNHO na listagem pública
    const listaAntesDePublicar = await request(app.getHttpServer())
      .get('/events')
      .expect(200);
    expect(
      (listaAntesDePublicar.body as { id: string }[]).some(
        (e) => e.id === eventoId,
      ),
    ).toBe(false);

    // 6. Organizador publica o evento
    await request(app.getHttpServer())
      .patch(`/events/${eventoId}`)
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .send({ status: 'PUBLICADO' })
      .expect(200);

    const listaDepoisDePublicar = await request(app.getHttpServer())
      .get('/events')
      .expect(200);
    expect(
      (listaDepoisDePublicar.body as { id: string }[]).some(
        (e) => e.id === eventoId,
      ),
    ).toBe(true);

    // 7. Outro papel (organizador) não pode reservar — só CLIENTE
    await request(app.getHttpServer())
      .post(`/sessoes/${sessaoId}/bookings`)
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .send({ ticketTypeId, quantidade: 1 })
      .expect(403);

    // 8. Cliente reserva o ingresso gratuito — confirma na hora, sem Stripe
    const reserva = await request(app.getHttpServer())
      .post(`/sessoes/${sessaoId}/bookings`)
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ ticketTypeId, quantidade: 1 })
      .expect(201);

    const { bookingId, clientSecret } = reserva.body as RespostaReserva;
    expect(clientSecret).toBeNull();

    // 9. O ingresso aparece em "meus ingressos" do cliente
    const meusIngressos = await request(app.getHttpServer())
      .get('/bookings/minhas')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .expect(200);
    expect(
      (meusIngressos.body as { id: string }[]).some((b) => b.id === bookingId),
    ).toBe(true);

    const booking = await request(app.getHttpServer())
      .get(`/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${tokenCliente}`)
      .expect(200);
    const { codigoCompra } = booking.body as RespostaBooking;

    // 10. Portaria valida o código — primeira vez: válido
    const primeiraValidacao = await request(app.getHttpServer())
      .post('/tickets/validar')
      .set('Authorization', `Bearer ${tokenPortaria}`)
      .send({ codigo: codigoCompra, eventoId })
      .expect(201);
    expect((primeiraValidacao.body as RespostaValidacao).situacao).toBe(
      'valido',
    );

    // 11. Segunda validação do mesmo código: já utilizado
    const segundaValidacao = await request(app.getHttpServer())
      .post('/tickets/validar')
      .set('Authorization', `Bearer ${tokenPortaria}`)
      .send({ codigo: codigoCompra, eventoId })
      .expect(201);
    expect((segundaValidacao.body as RespostaValidacao).situacao).toBe(
      'ja-utilizado',
    );

    // 12. Código inexistente é inválido
    const codigoInvalido = await request(app.getHttpServer())
      .post('/tickets/validar')
      .set('Authorization', `Bearer ${tokenPortaria}`)
      .send({ codigo: 'TLO-000000', eventoId })
      .expect(201);
    expect((codigoInvalido.body as RespostaValidacao).situacao).toBe(
      'invalido',
    );

    // 13. Cliente não consegue cancelar um ingresso já USADO
    await request(app.getHttpServer())
      .delete(`/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${tokenCliente}`)
      .expect(409);
  });

  it('impede que o mesmo assento seja reservado duas vezes', async () => {
    const organizador = await registrar(
      'ORGANIZADOR',
      'organizador-assentos',
    ).expect(201);
    const clienteA = await registrar('CLIENTE', 'cliente-a-assentos').expect(
      201,
    );
    const clienteB = await registrar('CLIENTE', 'cliente-b-assentos').expect(
      201,
    );

    const tokenOrganizador = (organizador.body as RespostaAuth).accessToken;
    const tokenClienteA = (clienteA.body as RespostaAuth).accessToken;
    const tokenClienteB = (clienteB.body as RespostaAuth).accessToken;

    const evento = await request(app.getHttpServer())
      .post('/events')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .send({
        titulo: 'Evento Assentos E2E',
        categoria: 'teatro',
        modalidade: 'presencial',
        cidade: 'São Paulo',
        endereco: {
          rua: 'Rua Teste',
          numero: '1',
          bairro: 'Centro',
          cidade: 'São Paulo',
          estado: 'SP',
        },
        gradiente: 'from-purple-700 via-purple-600 to-purple-500',
        usaMapaAssentos: true,
        sessoes: [
          {
            dataHora: new Date(Date.now() + 48 * 60 * 60_000).toISOString(),
            ingressos: [
              {
                nome: 'Plateia',
                gratuito: true,
                preco: 0,
                capacidade: 50,
                publico: 'GERAL',
              },
            ],
          },
        ],
      })
      .expect(201);

    const { id: eventoId, sessoes } = evento.body as RespostaEvento;
    const sessaoId = sessoes[0].id;
    const ticketTypeId = sessoes[0].ticketTypes[0].id;
    await request(app.getHttpServer())
      .patch(`/events/${eventoId}`)
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .send({ status: 'PUBLICADO' })
      .expect(200);

    const [resultadoA, resultadoB] = await Promise.all([
      request(app.getHttpServer())
        .post(`/sessoes/${sessaoId}/bookings`)
        .set('Authorization', `Bearer ${tokenClienteA}`)
        .send({ ticketTypeId, assentos: ['A1'] }),
      request(app.getHttpServer())
        .post(`/sessoes/${sessaoId}/bookings`)
        .set('Authorization', `Bearer ${tokenClienteB}`)
        .send({ ticketTypeId, assentos: ['A1'] }),
    ]);

    const statusCodes = [resultadoA.status, resultadoB.status].sort();
    expect(statusCodes).toEqual([201, 409]);
  });
});
