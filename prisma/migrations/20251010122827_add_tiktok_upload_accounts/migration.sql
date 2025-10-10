-- CreateEnum
CREATE TYPE "public"."TiktokAccountStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "public"."tiktok_upload_accounts" (
    "id" TEXT NOT NULL,
    "openId" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "status" "public"."TiktokAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_upload_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_upload_accounts_openId_key" ON "public"."tiktok_upload_accounts"("openId");

-- CreateIndex
CREATE INDEX "tiktok_upload_accounts_openId_idx" ON "public"."tiktok_upload_accounts"("openId");

-- CreateIndex
CREATE INDEX "tiktok_upload_accounts_status_idx" ON "public"."tiktok_upload_accounts"("status");
