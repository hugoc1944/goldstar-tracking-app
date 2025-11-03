-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."SendBudgetJob" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "status" "public"."JobStatus" NOT NULL DEFAULT 'QUEUED',
    "pdfUrl" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SendBudgetJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SendBudgetJob_idempotencyKey_key" ON "public"."SendBudgetJob"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "SendBudgetJob_budgetId_status_key" ON "public"."SendBudgetJob"("budgetId", "status");
