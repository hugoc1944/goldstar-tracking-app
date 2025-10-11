/*
  Warnings:

  - A unique constraint covering the columns `[convertedOrderId]` on the table `Budget` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Budget" ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "convertedOrderId" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "confirmedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Budget_convertedOrderId_key" ON "public"."Budget"("convertedOrderId");

-- AddForeignKey
ALTER TABLE "public"."Budget" ADD CONSTRAINT "Budget_convertedOrderId_fkey" FOREIGN KEY ("convertedOrderId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
