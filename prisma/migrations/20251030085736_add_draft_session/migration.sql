-- AlterTable
ALTER TABLE "public"."remix_posts" ADD COLUMN     "sessionId" TEXT;

-- CreateTable
CREATE TABLE "public"."draft_sessions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "generationStrategy" TEXT NOT NULL,
    "languageStyle" TEXT NOT NULL,
    "contentIdeas" TEXT,
    "slidesRange" JSONB NOT NULL,
    "productContextId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "draft_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "draft_sessions_createdAt_idx" ON "public"."draft_sessions"("createdAt");

-- CreateIndex
CREATE INDEX "draft_sessions_productContextId_idx" ON "public"."draft_sessions"("productContextId");

-- CreateIndex
CREATE INDEX "remix_posts_sessionId_idx" ON "public"."remix_posts"("sessionId");

-- AddForeignKey
ALTER TABLE "public"."draft_sessions" ADD CONSTRAINT "draft_sessions_productContextId_fkey" FOREIGN KEY ("productContextId") REFERENCES "public"."product_contexts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."remix_posts" ADD CONSTRAINT "remix_posts_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."draft_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
