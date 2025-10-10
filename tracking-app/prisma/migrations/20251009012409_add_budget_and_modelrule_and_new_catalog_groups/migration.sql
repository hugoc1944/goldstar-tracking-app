/*
  Safe enum introduction + column cast + new tables.
  - We DO NOT drop data.
  - We create the enum with all old + new labels.
  - We cast CatalogOption.group to the enum.
  - (Optional) rename 'sort' -> 'order' if you used to have 'sort'.
*/

-- 1) Create the enum if it doesn't exist (includes ALL old and new labels)
DO $$ BEGIN
  CREATE TYPE "CatalogGroup" AS ENUM (
    -- EXISTING labels you already had:
    'MODEL',
    'HANDLE',
    'FINISH',
    'ACRYLIC',
    'SERIGRAPHY',
    -- NEW labels:
    'FINISH_METALICO',
    'FINISH_LACADO',
    'GLASS_TIPO',
    'MONOCROMATICO',
    'ACRYLIC_AND_POLICARBONATE',
    'SERIGRAFIA_PRIME',
    'SERIGRAFIA_QUADROS',
    'SERIGRAFIA_ELO_SERENO',
    'COMPLEMENTO',
    'VISION_BAR_COLOR'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) (Optional) If you previously had an index that referenced 'sort', drop it safely
DROP INDEX IF EXISTS "public"."CatalogOption_group_category_sort_idx";

-- 3) (Optional, recommended) If the old column was 'sort', rename it to 'order' to keep data
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'CatalogOption'
      AND column_name  = 'sort'
  ) THEN
    ALTER TABLE "public"."CatalogOption" RENAME COLUMN "sort" TO "order";
  END IF;
END $$;

-- Ensure 'order' has a default (only if you want it)
ALTER TABLE "public"."CatalogOption"
  ALTER COLUMN "order" SET DEFAULT 0;


UPDATE "public"."CatalogOption" SET "group" = 'MODEL' WHERE "group" = 'PROFILE';
-- 4) Cast the 'group' column from text -> enum (requires all current values to be enum labels)
ALTER TABLE "public"."CatalogOption"
  ALTER COLUMN "group" TYPE "CatalogGroup"
  USING ("group"::text::"CatalogGroup");

-- 5) New tables
CREATE TABLE "public"."Budget" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "nif" TEXT,
  "address" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "modelKey" TEXT NOT NULL,
  "handleKey" TEXT,
  "finishKey" TEXT NOT NULL,
  "barColor" TEXT NOT NULL,
  "glassTypeKey" TEXT NOT NULL,
  "acrylicKey" TEXT,
  "serigrafiaKey" TEXT,
  "serigrafiaColor" TEXT,
  "complemento" TEXT NOT NULL,
  "visionSupport" TEXT,
  "visionBar" TEXT,
  "towelColorMode" TEXT,
  "cornerChoice" TEXT,
  "cornerColorMode" TEXT,
  "widthMm" INTEGER,
  "heightMm" INTEGER,
  "depthMm" INTEGER,
  "willSendLater" BOOLEAN NOT NULL DEFAULT false,
  "deliveryType" TEXT NOT NULL,
  "housingType" TEXT,
  "floorNumber" INTEGER,
  "hasElevator" BOOLEAN,
  "photoUrls" JSONB,
  "priceCents" INTEGER,
  "installPriceCents" INTEGER,
  "notes" TEXT,
  "quotedPdfUrl" TEXT,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ModelRule" (
  "id" TEXT NOT NULL,
  "modelKey" TEXT NOT NULL,
  "hideHandles" BOOLEAN NOT NULL DEFAULT false,
  "removeFinishes" TEXT[],
  "allowAcrylicAndPoly" BOOLEAN NOT NULL DEFAULT false,
  "allowTowel1" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "ModelRule_pkey" PRIMARY KEY ("id")
);

-- 6) Helpful indexes
CREATE INDEX "Budget_createdAt_idx" ON "public"."Budget"("createdAt");
CREATE INDEX "Budget_email_idx" ON "public"."Budget"("email");
CREATE UNIQUE INDEX "ModelRule_modelKey_key" ON "public"."ModelRule"("modelKey");

-- 7) (LATER) Add this only after checking duplicates:
-- CREATE UNIQUE INDEX "CatalogOption_group_value_key" ON "public"."CatalogOption"("group", "value");
