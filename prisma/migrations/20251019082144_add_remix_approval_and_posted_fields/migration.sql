-- AlterTable
ALTER TABLE "public"."remix_posts" ADD COLUMN     "approved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "postedAt" TIMESTAMP(3),
ADD COLUMN     "postedUrl" TEXT;

-- CreateIndex
CREATE INDEX "remix_posts_bookmarked_approved_idx" ON "public"."remix_posts"("bookmarked", "approved");

-- CreateIndex
CREATE INDEX "remix_posts_postedUrl_idx" ON "public"."remix_posts"("postedUrl");
