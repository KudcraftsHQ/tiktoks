/*
  Warnings:

  - You are about to drop the column `imageKey` on the `carousel_images` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `carousel_images` table. All the data in the column will be lost.
  - You are about to drop the column `backgroundImageKey` on the `carousel_slides` table. All the data in the column will be lost.
  - You are about to drop the column `backgroundImageUrl` on the `carousel_slides` table. All the data in the column will be lost.
  - You are about to drop the column `authorAvatar` on the `carousels` table. All the data in the column will be lost.
  - You are about to drop the column `authorAvatarKey` on the `carousels` table. All the data in the column will be lost.
  - You are about to drop the column `authorAvatar` on the `tiktok_posts` table. All the data in the column will be lost.
  - You are about to drop the column `avatarKey` on the `tiktok_posts` table. All the data in the column will be lost.
  - You are about to drop the column `coverKey` on the `tiktok_posts` table. All the data in the column will be lost.
  - You are about to drop the column `coverUrl` on the `tiktok_posts` table. All the data in the column will be lost.
  - You are about to drop the column `musicKey` on the `tiktok_posts` table. All the data in the column will be lost.
  - You are about to drop the column `musicUrl` on the `tiktok_posts` table. All the data in the column will be lost.
  - You are about to drop the column `videoKey` on the `tiktok_posts` table. All the data in the column will be lost.
  - You are about to drop the column `videoUrl` on the `tiktok_posts` table. All the data in the column will be lost.
  - You are about to drop the column `avatar` on the `tiktok_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `avatarKey` on the `tiktok_profiles` table. All the data in the column will be lost.
  - Added the required column `imageId` to the `carousel_images` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."carousel_images" DROP COLUMN "imageKey",
DROP COLUMN "imageUrl",
ADD COLUMN     "imageId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "public"."carousel_slides" DROP COLUMN "backgroundImageKey",
DROP COLUMN "backgroundImageUrl",
ADD COLUMN     "backgroundImageId" UUID;

-- AlterTable
ALTER TABLE "public"."carousels" DROP COLUMN "authorAvatar",
DROP COLUMN "authorAvatarKey",
ADD COLUMN     "authorAvatarId" UUID;

-- AlterTable
ALTER TABLE "public"."tiktok_posts" DROP COLUMN "authorAvatar",
DROP COLUMN "avatarKey",
DROP COLUMN "coverKey",
DROP COLUMN "coverUrl",
DROP COLUMN "musicKey",
DROP COLUMN "musicUrl",
DROP COLUMN "videoKey",
DROP COLUMN "videoUrl",
ADD COLUMN     "authorAvatarId" UUID,
ADD COLUMN     "coverId" UUID,
ADD COLUMN     "musicId" UUID,
ADD COLUMN     "videoId" UUID;

-- AlterTable
ALTER TABLE "public"."tiktok_profiles" DROP COLUMN "avatar",
DROP COLUMN "avatarKey",
ADD COLUMN     "avatarId" UUID;
