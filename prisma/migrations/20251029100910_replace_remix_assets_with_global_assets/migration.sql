/*
  Warnings:

  - You are about to drop the `remix_asset_folders` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `remix_assets` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."remix_asset_folders" DROP CONSTRAINT "remix_asset_folders_remixId_fkey";

-- DropForeignKey
ALTER TABLE "public"."remix_assets" DROP CONSTRAINT "remix_assets_folderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."remix_assets" DROP CONSTRAINT "remix_assets_remixId_fkey";

-- DropTable
DROP TABLE "public"."remix_asset_folders";

-- DropTable
DROP TABLE "public"."remix_assets";

-- CreateTable
CREATE TABLE "asset_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "folderId" TEXT,
    "cacheAssetId" UUID NOT NULL,
    "name" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assets_folderId_idx" ON "assets"("folderId");

-- CreateIndex
CREATE INDEX "assets_cacheAssetId_idx" ON "assets"("cacheAssetId");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "asset_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
