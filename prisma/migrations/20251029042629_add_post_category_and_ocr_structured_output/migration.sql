-- AlterTable
ALTER TABLE "public"."tiktok_posts" ADD COLUMN     "categoryConfidence" DOUBLE PRECISION,
ADD COLUMN     "ocrData" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "postCategoryId" TEXT;

-- CreateTable
CREATE TABLE "public"."post_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "postCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "post_categories_name_key" ON "public"."post_categories"("name");

-- CreateIndex
CREATE INDEX "post_categories_name_idx" ON "public"."post_categories"("name");

-- CreateIndex
CREATE INDEX "post_categories_aiGenerated_idx" ON "public"."post_categories"("aiGenerated");

-- CreateIndex
CREATE INDEX "tiktok_posts_postCategoryId_idx" ON "public"."tiktok_posts"("postCategoryId");

-- AddForeignKey
ALTER TABLE "public"."tiktok_posts" ADD CONSTRAINT "tiktok_posts_postCategoryId_fkey" FOREIGN KEY ("postCategoryId") REFERENCES "public"."post_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
