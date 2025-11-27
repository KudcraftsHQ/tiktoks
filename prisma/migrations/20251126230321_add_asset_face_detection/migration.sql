-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "faceAnalyzedAt" TIMESTAMP(3),
ADD COLUMN     "hasFace" BOOLEAN;

-- CreateIndex
CREATE INDEX "assets_hasFace_idx" ON "assets"("hasFace");
