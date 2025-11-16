-- Rename collections table to projects
ALTER TABLE "public"."collections" RENAME TO "projects";

-- Rename collection_posts table to project_posts
ALTER TABLE "public"."collection_posts" RENAME TO "project_posts";

-- Rename column collectionId to projectId in project_posts
ALTER TABLE "public"."project_posts" RENAME COLUMN "collectionId" TO "projectId";

-- Add order column to project_posts
ALTER TABLE "public"."project_posts" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Add projectId column to remix_posts
ALTER TABLE "public"."remix_posts" ADD COLUMN "projectId" TEXT;

-- Create index for remix_posts.projectId
CREATE INDEX "remix_posts_projectId_idx" ON "public"."remix_posts"("projectId");

-- Add foreign key for remix_posts.projectId
ALTER TABLE "public"."remix_posts" ADD CONSTRAINT "remix_posts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
