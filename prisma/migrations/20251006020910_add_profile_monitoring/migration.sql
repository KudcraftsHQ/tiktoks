-- AlterTable
ALTER TABLE "public"."tiktok_profiles" ADD COLUMN     "lastMonitoringRun" TIMESTAMP(3),
ADD COLUMN     "monitoringEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nextMonitoringRun" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."tiktok_post_metrics_history" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "viewCount" BIGINT,
    "likeCount" INTEGER,
    "shareCount" INTEGER,
    "commentCount" INTEGER,
    "saveCount" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiktok_post_metrics_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."profile_monitoring_logs" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "postsScraped" INTEGER,
    "pagesScraped" INTEGER,
    "error" TEXT,

    CONSTRAINT "profile_monitoring_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tiktok_post_metrics_history_postId_recordedAt_idx" ON "public"."tiktok_post_metrics_history"("postId", "recordedAt");

-- CreateIndex
CREATE INDEX "profile_monitoring_logs_profileId_startedAt_idx" ON "public"."profile_monitoring_logs"("profileId", "startedAt");

-- CreateIndex
CREATE INDEX "profile_monitoring_logs_status_idx" ON "public"."profile_monitoring_logs"("status");

-- CreateIndex
CREATE INDEX "tiktok_profiles_monitoringEnabled_nextMonitoringRun_idx" ON "public"."tiktok_profiles"("monitoringEnabled", "nextMonitoringRun");

-- AddForeignKey
ALTER TABLE "public"."tiktok_post_metrics_history" ADD CONSTRAINT "tiktok_post_metrics_history_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."tiktok_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."profile_monitoring_logs" ADD CONSTRAINT "profile_monitoring_logs_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."tiktok_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
