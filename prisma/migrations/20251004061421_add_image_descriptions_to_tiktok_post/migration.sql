-- AlterTable
ALTER TABLE "public"."tiktok_posts" ADD COLUMN     "imageDescriptions" JSONB NOT NULL DEFAULT '[]';
