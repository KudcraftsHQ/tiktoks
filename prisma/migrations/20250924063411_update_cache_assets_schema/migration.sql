/*
  Warnings:

  - You are about to drop the column `cacheAssetId` on the `carousel_images` table. All the data in the column will be lost.
  - You are about to drop the column `backgroundCacheAssetId` on the `carousel_slides` table. All the data in the column will be lost.
  - You are about to drop the column `authorAvatarCacheAssetId` on the `carousels` table. All the data in the column will be lost.
  - You are about to drop the column `coverCacheAssetId` on the `tiktok_posts` table. All the data in the column will be lost.
  - You are about to drop the column `musicCacheAssetId` on the `tiktok_posts` table. All the data in the column will be lost.
  - You are about to drop the column `videoCacheAssetId` on the `tiktok_posts` table. All the data in the column will be lost.
  - You are about to drop the column `avatarCacheAssetId` on the `tiktok_profiles` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."carousel_images" DROP CONSTRAINT "carousel_images_cacheAssetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."carousel_slides" DROP CONSTRAINT "carousel_slides_backgroundCacheAssetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."carousels" DROP CONSTRAINT "carousels_authorAvatarCacheAssetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."tiktok_posts" DROP CONSTRAINT "tiktok_posts_coverCacheAssetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."tiktok_posts" DROP CONSTRAINT "tiktok_posts_musicCacheAssetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."tiktok_posts" DROP CONSTRAINT "tiktok_posts_videoCacheAssetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."tiktok_profiles" DROP CONSTRAINT "tiktok_profiles_avatarCacheAssetId_fkey";

-- AlterTable
ALTER TABLE "public"."carousel_images" DROP COLUMN "cacheAssetId";

-- AlterTable
ALTER TABLE "public"."carousel_slides" DROP COLUMN "backgroundCacheAssetId";

-- AlterTable
ALTER TABLE "public"."carousels" DROP COLUMN "authorAvatarCacheAssetId";

-- AlterTable
ALTER TABLE "public"."tiktok_posts" DROP COLUMN "coverCacheAssetId",
DROP COLUMN "musicCacheAssetId",
DROP COLUMN "videoCacheAssetId";

-- AlterTable
ALTER TABLE "public"."tiktok_profiles" DROP COLUMN "avatarCacheAssetId";
