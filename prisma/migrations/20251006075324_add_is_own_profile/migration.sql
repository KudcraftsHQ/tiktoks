-- AlterTable
ALTER TABLE "public"."tiktok_profiles" ADD COLUMN     "isOwnProfile" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "tiktok_profiles_isOwnProfile_idx" ON "public"."tiktok_profiles"("isOwnProfile");
