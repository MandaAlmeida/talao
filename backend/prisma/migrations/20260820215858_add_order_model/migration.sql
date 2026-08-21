-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDENTE', 'CONFIRMADO', 'CANCELADO', 'EXPIRADO');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "valorCentavos" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDENTE',
    "valorTotalCentavos" INTEGER NOT NULL,
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripePaymentIntentId_key" ON "Order"("stripePaymentIntentId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "Sessao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
