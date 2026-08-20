-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "expiraEm" TIMESTAMP(3),
ADD COLUMN     "stripePaymentIntentId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'PENDENTE';

-- CreateIndex
CREATE UNIQUE INDEX "Booking_stripePaymentIntentId_key" ON "Booking"("stripePaymentIntentId");
