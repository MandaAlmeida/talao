/*
  Warnings:

  - You are about to drop the column `eventoId` on the `TicketType` table. All the data in the column will be lost.
  - Added the required column `sessaoId` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sessaoId` to the `TicketType` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "TicketType" DROP CONSTRAINT "TicketType_eventoId_fkey";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "sessaoId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TicketType" DROP COLUMN "eventoId",
ADD COLUMN     "sessaoId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Sessao" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "sala" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketType" ADD CONSTRAINT "TicketType_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "Sessao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "Sessao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
