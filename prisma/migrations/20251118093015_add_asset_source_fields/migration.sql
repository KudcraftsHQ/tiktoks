-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "sourceType" TEXT,
ADD COLUMN     "sourceUrl" TEXT;

-- AlterTable
ALTER TABLE "project_posts" RENAME CONSTRAINT "collection_posts_pkey" TO "project_posts_pkey";

-- AlterTable
ALTER TABLE "projects" RENAME CONSTRAINT "collections_pkey" TO "projects_pkey";

-- CreateIndex
CREATE INDEX "assets_sourceUrl_idx" ON "assets"("sourceUrl");

-- RenameForeignKey
ALTER TABLE "project_posts" RENAME CONSTRAINT "collection_posts_collectionId_fkey" TO "project_posts_projectId_fkey";

-- RenameForeignKey
ALTER TABLE "project_posts" RENAME CONSTRAINT "collection_posts_postId_fkey" TO "project_posts_postId_fkey";

-- RenameIndex
ALTER INDEX "collection_posts_collectionId_idx" RENAME TO "project_posts_projectId_idx";

-- RenameIndex
ALTER INDEX "collection_posts_collectionId_postId_key" RENAME TO "project_posts_projectId_postId_key";

-- RenameIndex
ALTER INDEX "collection_posts_postId_idx" RENAME TO "project_posts_postId_idx";
