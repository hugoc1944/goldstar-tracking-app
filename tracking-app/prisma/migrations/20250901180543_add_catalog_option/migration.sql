/*
  Warnings:

  - A unique constraint covering the columns `[group,value]` on the table `CatalogOption` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CatalogOption_group_value_key" ON "public"."CatalogOption"("group", "value");
