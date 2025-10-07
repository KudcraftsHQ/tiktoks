-- AlterTable
ALTER TABLE "public"."remix_posts" ADD COLUMN     "bookmarked" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "remix_posts_bookmarked_idx" ON "public"."remix_posts"("bookmarked");
