-- CreateTable
CREATE TABLE "public"."conversations" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "selectedPostIds" TEXT[],
    "messages" JSONB NOT NULL,
    "currentModel" TEXT NOT NULL DEFAULT 'gemini-2.0-flash-thinking-exp-1219',
    "totalInputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalOutputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_updatedAt_idx" ON "public"."conversations"("updatedAt");
