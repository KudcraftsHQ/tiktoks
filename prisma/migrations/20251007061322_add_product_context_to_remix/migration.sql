-- AlterTable
ALTER TABLE "public"."remix_posts" ADD COLUMN     "additionalPrompt" TEXT,
ADD COLUMN     "productContextId" TEXT;

-- CreateIndex
CREATE INDEX "remix_posts_productContextId_idx" ON "public"."remix_posts"("productContextId");

-- AddForeignKey
ALTER TABLE "public"."remix_posts" ADD CONSTRAINT "remix_posts_productContextId_fkey" FOREIGN KEY ("productContextId") REFERENCES "public"."product_contexts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
