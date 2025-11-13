-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('HIGH_VIEWS', 'VIRAL_CONTENT', 'LOW_PERFORMANCE', 'NEW_POST');

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "postId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_read_createdAt_idx" ON "public"."notifications"("read", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_postId_type_idx" ON "public"."notifications"("postId", "type");

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."tiktok_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
