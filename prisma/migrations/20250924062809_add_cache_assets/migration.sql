-- CreateEnum
CREATE TYPE "public"."CacheStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'CACHED', 'FAILED');

-- AlterTable
ALTER TABLE "public"."carousel_images" ADD COLUMN     "cacheAssetId" UUID;

-- AlterTable
ALTER TABLE "public"."carousel_slides" ADD COLUMN     "backgroundCacheAssetId" UUID;

-- AlterTable
ALTER TABLE "public"."carousels" ADD COLUMN     "authorAvatarCacheAssetId" UUID;

-- AlterTable
ALTER TABLE "public"."tiktok_posts" ADD COLUMN     "coverCacheAssetId" UUID,
ADD COLUMN     "musicCacheAssetId" UUID,
ADD COLUMN     "videoCacheAssetId" UUID;

-- AlterTable
ALTER TABLE "public"."tiktok_profiles" ADD COLUMN     "avatarCacheAssetId" UUID;

-- CreateTable
CREATE TABLE "public"."cache_assets" (
    "id" UUID NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "cacheKey" TEXT,
    "status" "public"."CacheStatus" NOT NULL DEFAULT 'PENDING',
    "fileSize" INTEGER,
    "contentType" TEXT,
    "cachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cache_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cache_assets_originalUrl_key" ON "public"."cache_assets"("originalUrl");

-- CreateIndex
CREATE INDEX "cache_assets_status_idx" ON "public"."cache_assets"("status");

-- CreateIndex
CREATE INDEX "cache_assets_originalUrl_idx" ON "public"."cache_assets"("originalUrl");

-- AddForeignKey
ALTER TABLE "public"."carousels" ADD CONSTRAINT "carousels_authorAvatarCacheAssetId_fkey" FOREIGN KEY ("authorAvatarCacheAssetId") REFERENCES "public"."cache_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carousel_slides" ADD CONSTRAINT "carousel_slides_backgroundCacheAssetId_fkey" FOREIGN KEY ("backgroundCacheAssetId") REFERENCES "public"."cache_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carousel_images" ADD CONSTRAINT "carousel_images_cacheAssetId_fkey" FOREIGN KEY ("cacheAssetId") REFERENCES "public"."cache_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tiktok_profiles" ADD CONSTRAINT "tiktok_profiles_avatarCacheAssetId_fkey" FOREIGN KEY ("avatarCacheAssetId") REFERENCES "public"."cache_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tiktok_posts" ADD CONSTRAINT "tiktok_posts_videoCacheAssetId_fkey" FOREIGN KEY ("videoCacheAssetId") REFERENCES "public"."cache_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tiktok_posts" ADD CONSTRAINT "tiktok_posts_coverCacheAssetId_fkey" FOREIGN KEY ("coverCacheAssetId") REFERENCES "public"."cache_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tiktok_posts" ADD CONSTRAINT "tiktok_posts_musicCacheAssetId_fkey" FOREIGN KEY ("musicCacheAssetId") REFERENCES "public"."cache_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
