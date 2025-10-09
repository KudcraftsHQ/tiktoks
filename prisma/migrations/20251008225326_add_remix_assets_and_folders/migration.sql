-- CreateTable
CREATE TABLE "public"."remix_asset_folders" (
    "id" TEXT NOT NULL,
    "remixId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remix_asset_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."remix_assets" (
    "id" TEXT NOT NULL,
    "remixId" TEXT NOT NULL,
    "folderId" TEXT,
    "cacheAssetId" UUID NOT NULL,
    "name" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remix_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "remix_asset_folders_remixId_idx" ON "public"."remix_asset_folders"("remixId");

-- CreateIndex
CREATE INDEX "remix_assets_remixId_idx" ON "public"."remix_assets"("remixId");

-- CreateIndex
CREATE INDEX "remix_assets_folderId_idx" ON "public"."remix_assets"("folderId");

-- CreateIndex
CREATE INDEX "remix_assets_cacheAssetId_idx" ON "public"."remix_assets"("cacheAssetId");

-- AddForeignKey
ALTER TABLE "public"."remix_asset_folders" ADD CONSTRAINT "remix_asset_folders_remixId_fkey" FOREIGN KEY ("remixId") REFERENCES "public"."remix_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."remix_assets" ADD CONSTRAINT "remix_assets_remixId_fkey" FOREIGN KEY ("remixId") REFERENCES "public"."remix_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."remix_assets" ADD CONSTRAINT "remix_assets_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "public"."remix_asset_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
