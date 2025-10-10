-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "deliveryType" TEXT,
ADD COLUMN     "floorNumber" INTEGER,
ADD COLUMN     "hasElevator" BOOLEAN,
ADD COLUMN     "housingType" TEXT;
