-- CreateTable
CREATE TABLE "public"."tiktok_profiles" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "nickname" TEXT,
    "avatar" TEXT,
    "bio" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "followerCount" INTEGER DEFAULT 0,
    "followingCount" INTEGER DEFAULT 0,
    "videoCount" INTEGER DEFAULT 0,
    "likeCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tiktok_posts" (
    "id" TEXT NOT NULL,
    "tiktokId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "tiktokUrl" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "videoUrl" TEXT,
    "coverUrl" TEXT,
    "musicUrl" TEXT,
    "images" JSONB NOT NULL DEFAULT '[]',
    "authorNickname" TEXT,
    "authorHandle" TEXT,
    "authorAvatar" TEXT,
    "hashtags" JSONB NOT NULL DEFAULT '[]',
    "mentions" JSONB NOT NULL DEFAULT '[]',
    "viewCount" BIGINT DEFAULT 0,
    "likeCount" INTEGER DEFAULT 0,
    "shareCount" INTEGER DEFAULT 0,
    "commentCount" INTEGER DEFAULT 0,
    "saveCount" INTEGER DEFAULT 0,
    "duration" DOUBLE PRECISION,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collection_posts" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_profiles_handle_key" ON "public"."tiktok_profiles"("handle");

-- CreateIndex
CREATE INDEX "tiktok_profiles_handle_idx" ON "public"."tiktok_profiles"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_posts_tiktokId_key" ON "public"."tiktok_posts"("tiktokId");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_posts_tiktokUrl_key" ON "public"."tiktok_posts"("tiktokUrl");

-- CreateIndex
CREATE INDEX "tiktok_posts_profileId_idx" ON "public"."tiktok_posts"("profileId");

-- CreateIndex
CREATE INDEX "tiktok_posts_contentType_idx" ON "public"."tiktok_posts"("contentType");

-- CreateIndex
CREATE INDEX "tiktok_posts_publishedAt_idx" ON "public"."tiktok_posts"("publishedAt");

-- CreateIndex
CREATE INDEX "tiktok_posts_authorHandle_idx" ON "public"."tiktok_posts"("authorHandle");

-- CreateIndex
CREATE INDEX "collection_posts_collectionId_idx" ON "public"."collection_posts"("collectionId");

-- CreateIndex
CREATE INDEX "collection_posts_postId_idx" ON "public"."collection_posts"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "collection_posts_collectionId_postId_key" ON "public"."collection_posts"("collectionId", "postId");

-- AddForeignKey
ALTER TABLE "public"."tiktok_posts" ADD CONSTRAINT "tiktok_posts_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."tiktok_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collection_posts" ADD CONSTRAINT "collection_posts_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "public"."collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collection_posts" ADD CONSTRAINT "collection_posts_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."tiktok_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
