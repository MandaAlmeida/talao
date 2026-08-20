import { PrismaClient, Role, EventStatus, TicketAudience, BookingStatus } from '@prisma/client';
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

  // Evento 1: categoria teatro, com mapa de assentos, 3 sessões diárias
  const eventoTeatro = await prisma.event.create({
    data: {
      titulo: 'Marrom, o Musical',
      categoria: 'teatro',
      usaMapaAssentos: true,
      assunto: 'Música e teatro',
      descricaoCompleta:
        'Um espetáculo musical que celebra a trajetória de Alcione, com direção de Miguel Falabella.',
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
    include: { sessoes: { include: { ticketTypes: true }, orderBy: { dataHora: 'asc' } } },
  });

  const sessaoTeatro1 = eventoTeatro.sessoes[0];
  const ticketTeatro = sessaoTeatro1.ticketTypes[0];

  await prisma.seat.createMany({
    data: codigosDeAssento().map((codigo) => ({
      ticketTypeId: ticketTeatro.id,
      codigo,
    })),
  });

  // Evento 2: categoria show, sessão única, estoque por quantidade
  const eventoShow = await prisma.event.create({
    data: {
      titulo: 'Noite do Rock',
      categoria: 'show',
      assunto: 'Show de rock nacional',
      descricaoCompleta:
        'Uma noite com as principais bandas de rock da cena nacional em um só palco.',
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

  const sessaoShow = eventoShow.sessoes[0];
  const ticketShow = sessaoShow.ticketTypes[0];

  // Assentos A1, A2 ocupados por uma booking confirmada (cliente1)
  const seatsParaReservar = await prisma.seat.findMany({
    where: { ticketTypeId: ticketTeatro.id, codigo: { in: ['A1', 'A2'] } },
  });

  const codigoTeatro = gerarCodigoCompra();
  const bookingTeatro = await prisma.booking.create({
    data: {
      eventoId: eventoTeatro.id,
      sessaoId: sessaoTeatro1.id,
      ticketTypeId: ticketTeatro.id,
      clienteId: cliente1.id,
      quantidade: 2,
      status: BookingStatus.CONFIRMADO,
      codigoCompra: codigoTeatro,
      qrAssinatura: assinar(codigoTeatro),
    },
  });

  await prisma.seat.updateMany({
    where: { id: { in: seatsParaReservar.map((s) => s.id) } },
    data: { bookingId: bookingTeatro.id },
  });

  const codigoShow = gerarCodigoCompra();
  await prisma.booking.create({
    data: {
      eventoId: eventoShow.id,
      sessaoId: sessaoShow.id,
      ticketTypeId: ticketShow.id,
      clienteId: cliente2.id,
      quantidade: 3,
      status: BookingStatus.CONFIRMADO,
      codigoCompra: codigoShow,
      qrAssinatura: assinar(codigoShow),
    },
  });

  console.log('Seed concluído.');
  console.log(`Código de compra (teatro, confirmado): ${codigoTeatro}`);
  console.log(`Código de compra (show, confirmado): ${codigoShow}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
