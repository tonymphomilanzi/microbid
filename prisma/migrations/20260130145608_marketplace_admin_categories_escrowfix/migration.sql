-- CreateEnum
CREATE TYPE "AdPlacement" AS ENUM ('HOME_HERO', 'HOME_MID', 'MARKETPLACE_TOP', 'LISTING_DETAILS_SIDEBAR', 'DASHBOARD_TOP');

-- CreateEnum
CREATE TYPE "AdType" AS ENUM ('IMAGE', 'SPECIAL', 'ADSENSE_SNIPPET');

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "placement" "AdPlacement" NOT NULL,
    "type" "AdType" NOT NULL,
    "title" TEXT,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "html" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ad_placement_idx" ON "Ad"("placement");
