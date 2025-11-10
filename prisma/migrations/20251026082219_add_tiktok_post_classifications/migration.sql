-- AlterTable
ALTER TABLE "tiktok_posts" ADD COLUMN     "classificationProcessedAt" TIMESTAMP(3),
ADD COLUMN     "classificationStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "slideClassifications" JSONB NOT NULL DEFAULT '[]';
