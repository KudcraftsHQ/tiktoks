-- CreateTable
CREATE TABLE "public"."product_contexts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_contexts_title_idx" ON "public"."product_contexts"("title");
