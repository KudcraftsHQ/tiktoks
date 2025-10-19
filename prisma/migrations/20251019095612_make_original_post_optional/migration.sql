-- DropForeignKey
ALTER TABLE "public"."remix_posts" DROP CONSTRAINT "remix_posts_originalPostId_fkey";

-- AlterTable
ALTER TABLE "public"."remix_posts" ALTER COLUMN "originalPostId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."remix_posts" ADD CONSTRAINT "remix_posts_originalPostId_fkey" FOREIGN KEY ("originalPostId") REFERENCES "public"."tiktok_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
