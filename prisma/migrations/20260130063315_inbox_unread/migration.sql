-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "buyerUnread" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastMessageAt" TIMESTAMP(3),
ADD COLUMN     "sellerUnread" INTEGER NOT NULL DEFAULT 0;
