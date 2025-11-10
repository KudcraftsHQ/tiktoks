-- AlterTable
ALTER TABLE "public"."remix_posts" ADD COLUMN     "generationPrompt" TEXT,
ADD COLUMN     "isDraft" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "languageStyleTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "slideClassifications" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "sourcePostIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "public"."content_idea_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "slideCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_idea_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."slide_classification_index" (
    "id" TEXT NOT NULL,
    "remixPostId" TEXT NOT NULL,
    "slideIndex" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "contentText" TEXT NOT NULL,
    "sourcePostId" TEXT,
    "languageStyleTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slide_classification_index_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_idea_categories_type_idx" ON "public"."content_idea_categories"("type");

-- CreateIndex
CREATE INDEX "content_idea_categories_aiGenerated_idx" ON "public"."content_idea_categories"("aiGenerated");

-- CreateIndex
CREATE UNIQUE INDEX "content_idea_categories_name_type_key" ON "public"."content_idea_categories"("name", "type");

-- CreateIndex
CREATE INDEX "slide_classification_index_type_categoryId_idx" ON "public"."slide_classification_index"("type", "categoryId");

-- CreateIndex
CREATE INDEX "slide_classification_index_sourcePostId_idx" ON "public"."slide_classification_index"("sourcePostId");

-- CreateIndex
CREATE INDEX "slide_classification_index_remixPostId_slideIndex_idx" ON "public"."slide_classification_index"("remixPostId", "slideIndex");

-- CreateIndex
CREATE UNIQUE INDEX "slide_classification_index_remixPostId_slideIndex_key" ON "public"."slide_classification_index"("remixPostId", "slideIndex");

-- CreateIndex
CREATE INDEX "remix_posts_isDraft_idx" ON "public"."remix_posts"("isDraft");

-- CreateIndex
CREATE INDEX "remix_posts_generationType_idx" ON "public"."remix_posts"("generationType");

-- AddForeignKey
ALTER TABLE "public"."slide_classification_index" ADD CONSTRAINT "slide_classification_index_remixPostId_fkey" FOREIGN KEY ("remixPostId") REFERENCES "public"."remix_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."slide_classification_index" ADD CONSTRAINT "slide_classification_index_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."content_idea_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
