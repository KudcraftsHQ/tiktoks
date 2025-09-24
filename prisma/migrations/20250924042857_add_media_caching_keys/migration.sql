-- AlterTable
ALTER TABLE "public"."carousel_images" ADD COLUMN     "imageKey" TEXT;

-- AlterTable
ALTER TABLE "public"."carousel_slides" ADD COLUMN     "backgroundImageKey" TEXT;

-- AlterTable
ALTER TABLE "public"."carousels" ADD COLUMN     "authorAvatarKey" TEXT;

-- AlterTable
ALTER TABLE "public"."tiktok_posts" ADD COLUMN     "coverKey" TEXT,
ADD COLUMN     "musicKey" TEXT,
ADD COLUMN     "videoKey" TEXT;

-- AlterTable
ALTER TABLE "public"."tiktok_profiles" ADD COLUMN     "avatarKey" TEXT;
