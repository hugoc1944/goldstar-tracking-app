/*
  Warnings:

  - A unique constraint covering the columns `[publicToken]` on the table `Budget` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Budget" ADD COLUMN     "filesJson" JSONB,
ADD COLUMN     "publicToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Budget_publicToken_key" ON "public"."Budget"("publicToken");
