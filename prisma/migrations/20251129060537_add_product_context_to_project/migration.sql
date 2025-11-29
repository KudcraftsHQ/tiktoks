-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "productContextId" TEXT;

-- CreateIndex
CREATE INDEX "projects_productContextId_idx" ON "projects"("productContextId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_productContextId_fkey" FOREIGN KEY ("productContextId") REFERENCES "product_contexts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
