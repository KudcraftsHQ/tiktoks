-- AlterTable
ALTER TABLE "tiktok_profiles" ADD COLUMN     "profileGroupId" TEXT;

-- CreateTable
CREATE TABLE "profile_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profile_groups_name_key" ON "profile_groups"("name");

-- CreateIndex
CREATE INDEX "profile_groups_name_idx" ON "profile_groups"("name");

-- CreateIndex
CREATE INDEX "tiktok_profiles_profileGroupId_idx" ON "tiktok_profiles"("profileGroupId");

-- AddForeignKey
ALTER TABLE "tiktok_profiles" ADD CONSTRAINT "tiktok_profiles_profileGroupId_fkey" FOREIGN KEY ("profileGroupId") REFERENCES "profile_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
