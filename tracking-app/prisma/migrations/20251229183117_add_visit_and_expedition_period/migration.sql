-- CreateEnum
CREATE TYPE "public"."DayPeriod" AS ENUM ('MANHA', 'TARDE');

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "expeditionPeriod" "public"."DayPeriod",
ADD COLUMN     "visitPeriod" "public"."DayPeriod";
