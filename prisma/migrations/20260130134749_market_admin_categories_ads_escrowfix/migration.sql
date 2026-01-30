-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserTier" AS ENUM ('FREE', 'PRO', 'VIP');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'PAYPAL', 'BTC', 'MOMO', 'MANUAL');

-- CreateEnum
CREATE TYPE "EscrowMode" AS ENUM ('FASTEST', 'SAFEST');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('INITIATED', 'FEE_PAID', 'FULLY_PAID', 'AWAITING_SELLER_ASSIGN_ESCROW', 'ESCROW_ASSIGNED', 'BUYER_ASSIGNED_MANAGER', 'WAITING_7_DAYS', 'READY_FOR_FINAL_TRANSFER', 'AWAITING_BUYER_PAYMENT_TO_SELLER', 'AWAITING_SELLER_CONFIRMATION', 'TRANSFERRED_TO_BUYER', 'RELEASED', 'DISPUTED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProofKind" AS ENUM ('PAYMENT_PROOF', 'OWNERSHIP_TRANSFER_PROOF', 'EMAIL_CHANGE_PROOF', 'OTHER');

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER',
ADD COLUMN     "tier" "UserTier" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UsageMonth" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "listingsCreated" INTEGER NOT NULL DEFAULT 0,
    "conversationsStarted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "features" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowTransaction" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "escrowAgentId" TEXT NOT NULL,
    "mode" "EscrowMode" NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'INITIATED',
    "priceCents" INTEGER NOT NULL,
    "feeBps" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "minFeeCents" INTEGER NOT NULL,
    "discounts" JSONB,
    "totalChargeCents" INTEGER NOT NULL,
    "fundedAt" TIMESTAMP(3),
    "ownershipReadyAt" TIMESTAMP(3),
    "autoReleaseAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "providerRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscrowTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowProof" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "kind" "ProofKind" NOT NULL,
    "url" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAdminOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageMonth_userId_idx" ON "UsageMonth"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageMonth_userId_monthKey_key" ON "UsageMonth"("userId", "monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_userId_key" ON "UserSubscription"("userId");

-- CreateIndex
CREATE INDEX "EscrowTransaction_buyerId_idx" ON "EscrowTransaction"("buyerId");

-- CreateIndex
CREATE INDEX "EscrowTransaction_sellerId_idx" ON "EscrowTransaction"("sellerId");

-- CreateIndex
CREATE INDEX "EscrowTransaction_listingId_idx" ON "EscrowTransaction"("listingId");

-- CreateIndex
CREATE INDEX "EscrowProof_escrowId_idx" ON "EscrowProof"("escrowId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowProof" ADD CONSTRAINT "EscrowProof_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "EscrowTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
