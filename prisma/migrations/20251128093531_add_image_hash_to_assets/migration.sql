-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "imageHash" TEXT;

-- CreateIndex
CREATE INDEX "assets_imageHash_idx" ON "assets"("imageHash");
