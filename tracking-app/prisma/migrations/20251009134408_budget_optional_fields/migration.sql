-- AlterTable
ALTER TABLE "public"."Budget" ADD COLUMN     "fixingBarMode" TEXT,
ADD COLUMN     "shelfColorMode" TEXT,
ALTER COLUMN "barColor" DROP NOT NULL;
