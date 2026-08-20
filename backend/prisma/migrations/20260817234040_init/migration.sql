-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ORGANIZADOR', 'CLIENTE', 'PORTARIA');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('RASCUNHO', 'PUBLICADO');

-- CreateEnum
CREATE TYPE "TicketAudience" AS ENUM ('GERAL', 'RESTRITO');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMADO', 'CANCELADO', 'USADO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "assunto" TEXT,
    "descricaoCompleta" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'RASCUNHO',
    "modalidade" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "endereco" JSONB,
    "linkAcesso" TEXT,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "gradiente" TEXT NOT NULL,
    "tmdbId" INTEGER,
    "posterUrl" TEXT,
    "organizadorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketType" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "gratuito" BOOLEAN NOT NULL DEFAULT false,
    "preco" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "capacidade" INTEGER NOT NULL,
    "vendaInicio" TIMESTAMP(3),
    "vendaFim" TIMESTAMP(3),
    "publico" "TicketAudience" NOT NULL DEFAULT 'GERAL',
    "descricao" TEXT,

    CONSTRAINT "TicketType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seat" (
    "id" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "bookingId" TEXT,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMADO',
    "codigoCompra" TEXT NOT NULL,
    "qrAssinatura" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usadoEm" TIMESTAMP(3),

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Seat_ticketTypeId_codigo_key" ON "Seat"("ticketTypeId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_codigoCompra_key" ON "Booking"("codigoCompra");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_shareToken_key" ON "Booking"("shareToken");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizadorId_fkey" FOREIGN KEY ("organizadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketType" ADD CONSTRAINT "TicketType_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
