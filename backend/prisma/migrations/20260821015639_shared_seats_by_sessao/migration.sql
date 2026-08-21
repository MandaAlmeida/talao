-- Assentos deixam de pertencer a um TicketType e passam a pertencer à
-- Sessao inteira (compartilhados entre todos os tipos de ingresso da
-- mesma sessão). Os Seats existentes são apagados e serão regerados (80
-- por sessão) pelos fluxos de criação/atualização de evento já existentes
-- — decisão registrada em docs/superpowers/specs/2026-08-21-assentos-compartilhados-design.md.

-- DropForeignKey
ALTER TABLE "Seat" DROP CONSTRAINT "Seat_ticketTypeId_fkey";

-- DropIndex
DROP INDEX "Seat_ticketTypeId_codigo_key";

-- Apaga os assentos existentes: a coluna sessaoId não pode ser preenchida
-- automaticamente a partir de ticketTypeId sem ambiguidade quando uma
-- sessão tem múltiplos tipos de ingresso, e a decisão foi não preservar
-- histórico de ocupação nesta migração.
DELETE FROM "Seat";

-- AlterTable
ALTER TABLE "Seat" DROP COLUMN "ticketTypeId",
ADD COLUMN     "sessaoId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TicketType" ADD COLUMN     "fileiraFim" TEXT,
ADD COLUMN     "fileiraInicio" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Seat_sessaoId_codigo_key" ON "Seat"("sessaoId", "codigo");

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "Sessao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
