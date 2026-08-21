import {
  PrismaClient,
  Role,
  EventStatus,
  TicketAudience,
  BookingStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

const QR_SECRET = process.env.QR_SECRET ?? 'dev-only-change-me-qr-secret';

function assinar(codigo: string): string {
  return crypto.createHmac('sha256', QR_SECRET).update(codigo).digest('hex');
}

function gerarCodigoCompra(): string {
  return `TLO-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

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

async function main() {
  const senhaHash = await bcrypt.hash('senha123', 10);

  const organizador = await prisma.user.upsert({
    where: { email: 'organizador@talao.dev' },
    update: {},
    create: {
      nome: 'Ana Organizadora',
      email: 'organizador@talao.dev',
      senhaHash,
      papel: Role.ORGANIZADOR,
    },
  });

  const cliente1 = await prisma.user.upsert({
    where: { email: 'cliente1@talao.dev' },
    update: {},
    create: {
      nome: 'Bruno Cliente',
      email: 'cliente1@talao.dev',
      senhaHash,
      papel: Role.CLIENTE,
    },
  });

  const cliente2 = await prisma.user.upsert({
    where: { email: 'cliente2@talao.dev' },
    update: {},
    create: {
      nome: 'Carla Cliente',
      email: 'cliente2@talao.dev',
      senhaHash,
      papel: Role.CLIENTE,
    },
  });

  await prisma.user.upsert({
    where: { email: 'portaria@talao.dev' },
    update: {},
    create: {
      nome: 'Diego Portaria',
      email: 'portaria@talao.dev',
      senhaHash,
      papel: Role.PORTARIA,
    },
  });

  // Evento 1: categoria cinema, com mapa de assentos, 3 sessões diárias
  const eventoCinema1 = await prisma.event.create({
    data: {
      titulo: 'Homem-Aranha: Um Novo Dia',
      categoria: 'cinema',
      usaMapaAssentos: true,
      assunto: 'Ação e aventura',
      descricaoCompleta:
        'Peter Parker enfrenta uma nova ameaça que coloca em risco tudo o que ele conhece, em mais um capítulo da saga do Homem-Aranha.',
      status: EventStatus.PUBLICADO,
      modalidade: 'presencial',
      cidade: 'Brasília - DF',
      endereco: {
        rua: 'SCES Trecho 2',
        numero: 's/n',
        bairro: 'Setor de Clubes Esportivos Sul',
        cidade: 'Brasília',
        estado: 'DF',
      },
      dataInicio: new Date('2026-11-06T20:00:00Z'),
      dataFim: new Date('2026-11-08T20:00:00Z'),
      gradiente: 'from-orange-500 via-amber-400 to-pink-500',
      organizadorId: organizador.id,
      sessoes: {
        create: [
          {
            dataHora: new Date('2026-11-06T20:00:00Z'),
            sala: 'Sala 1',
            ticketTypes: {
              create: [
                {
                  nome: 'Pista',
                  gratuito: false,
                  preco: 120,
                  capacidade: 80,
                  publico: TicketAudience.GERAL,
                  descricao: 'Acesso à área comum do evento.',
                },
              ],
            },
          },
          {
            dataHora: new Date('2026-11-07T20:00:00Z'),
            sala: 'Sala 1',
            ticketTypes: {
              create: [
                {
                  nome: 'Pista',
                  gratuito: false,
                  preco: 120,
                  capacidade: 80,
                  publico: TicketAudience.GERAL,
                  descricao: 'Acesso à área comum do evento.',
                },
              ],
            },
          },
          {
            dataHora: new Date('2026-11-08T20:00:00Z'),
            sala: 'Sala 1',
            ticketTypes: {
              create: [
                {
                  nome: 'Pista',
                  gratuito: false,
                  preco: 120,
                  capacidade: 80,
                  publico: TicketAudience.GERAL,
                  descricao: 'Acesso à área comum do evento.',
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      sessoes: { include: { ticketTypes: true }, orderBy: { dataHora: 'asc' } },
    },
  });

  const sessaoCinema1a = eventoCinema1.sessoes[0];
  const ticketCinema1 = sessaoCinema1a.ticketTypes[0];

  await prisma.seat.createMany({
    data: codigosDeAssento().map((codigo) => ({
      sessaoId: sessaoCinema1a.id,
      codigo,
    })),
  });

  // Evento 2: categoria cinema, sessão única, estoque por quantidade
  const eventoCinema2 = await prisma.event.create({
    data: {
      titulo: 'Toy Story 5',
      categoria: 'cinema',
      assunto: 'Animação e família',
      descricaoCompleta:
        'Woody, Buzz e o resto da turma embarcam em uma nova aventura cheia de emoção para toda a família.',
      status: EventStatus.PUBLICADO,
      modalidade: 'presencial',
      cidade: 'São Paulo - SP',
      endereco: {
        rua: 'Av. Paulista',
        numero: '900',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        estado: 'SP',
      },
      dataInicio: new Date('2026-11-12T21:00:00Z'),
      dataFim: new Date('2026-11-12T21:00:00Z'),
      gradiente: 'from-purple-700 via-indigo-600 to-violet-500',
      organizadorId: organizador.id,
      sessoes: {
        create: [
          {
            dataHora: new Date('2026-11-12T21:00:00Z'),
            ticketTypes: {
              create: [
                {
                  nome: 'Inteira',
                  gratuito: false,
                  preco: 90,
                  capacidade: 500,
                  publico: TicketAudience.GERAL,
                  descricao: '',
                },
              ],
            },
          },
        ],
      },
    },
    include: { sessoes: { include: { ticketTypes: true } } },
  });

  const sessaoCinema2 = eventoCinema2.sessoes[0];
  const ticketCinema2 = sessaoCinema2.ticketTypes[0];

  // Assentos A1, A2 ocupados por uma booking confirmada (cliente1)
  const seatsParaReservar = await prisma.seat.findMany({
    where: { sessaoId: sessaoCinema1a.id, codigo: { in: ['A1', 'A2'] } },
  });

  const codigoCinema1 = gerarCodigoCompra();
  const bookingCinema1 = await prisma.booking.create({
    data: {
      eventoId: eventoCinema1.id,
      sessaoId: sessaoCinema1a.id,
      ticketTypeId: ticketCinema1.id,
      clienteId: cliente1.id,
      quantidade: 2,
      status: BookingStatus.CONFIRMADO,
      codigoCompra: codigoCinema1,
      qrAssinatura: assinar(codigoCinema1),
    },
  });

  await prisma.seat.updateMany({
    where: { id: { in: seatsParaReservar.map((s) => s.id) } },
    data: { bookingId: bookingCinema1.id },
  });

  const codigoCinema2 = gerarCodigoCompra();
  await prisma.booking.create({
    data: {
      eventoId: eventoCinema2.id,
      sessaoId: sessaoCinema2.id,
      ticketTypeId: ticketCinema2.id,
      clienteId: cliente2.id,
      quantidade: 3,
      status: BookingStatus.CONFIRMADO,
      codigoCompra: codigoCinema2,
      qrAssinatura: assinar(codigoCinema2),
    },
  });

  console.log('Seed concluído.');
  console.log(
    `Código de compra (Homem-Aranha: Um Novo Dia, confirmado): ${codigoCinema1}`,
  );
  console.log(`Código de compra (Toy Story 5, confirmado): ${codigoCinema2}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
