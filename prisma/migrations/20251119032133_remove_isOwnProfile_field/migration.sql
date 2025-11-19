-- DropIndex
DROP INDEX "tiktok_profiles_isOwnProfile_idx";

-- AlterTable
ALTER TABLE "tiktok_profiles" DROP COLUMN "isOwnProfile";
