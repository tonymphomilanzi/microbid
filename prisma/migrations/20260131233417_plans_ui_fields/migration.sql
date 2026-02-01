-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('FREE', 'MONTHLY', 'LIFETIME');

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "billingType" "BillingType" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "highlight" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monthlyPriceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "oneTimePriceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tagline" TEXT;
