-- CreateTable
CREATE TABLE "public"."CatalogOption" (
    "id" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "category" TEXT,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CatalogOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogOption_group_category_sort_idx" ON "public"."CatalogOption"("group", "category", "sort");
