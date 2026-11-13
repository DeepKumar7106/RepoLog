-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED');

-- AlterTable
ALTER TABLE "SyncRun" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "lockedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GitHubWebhookDelivery" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "action" TEXT,
    "repositoryGithubId" TEXT,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GitHubWebhookDelivery_deliveryId_key" ON "GitHubWebhookDelivery"("deliveryId");

-- CreateIndex
CREATE INDEX "GitHubWebhookDelivery_status_createdAt_idx" ON "GitHubWebhookDelivery"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GitHubWebhookDelivery_repositoryGithubId_idx" ON "GitHubWebhookDelivery"("repositoryGithubId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncRun_dedupeKey_key" ON "SyncRun"("dedupeKey");

-- CreateIndex
CREATE INDEX "SyncRun_status_availableAt_idx" ON "SyncRun"("status", "availableAt");
