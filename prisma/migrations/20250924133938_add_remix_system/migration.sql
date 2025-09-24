-- AlterTable
ALTER TABLE "public"."tiktok_posts" ADD COLUMN     "ocrProcessedAt" TIMESTAMP(3),
ADD COLUMN     "ocrStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "ocrTexts" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "public"."remix_posts" (
    "id" TEXT NOT NULL,
    "originalPostId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "generationType" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remix_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."remix_slides" (
    "id" TEXT NOT NULL,
    "remixPostId" TEXT NOT NULL,
    "originalImageId" UUID,
    "backgroundImageId" UUID,
    "displayOrder" INTEGER NOT NULL,
    "backgroundImagePositionX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "backgroundImagePositionY" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "backgroundImageZoom" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remix_slides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."remix_text_boxes" (
    "id" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "fontSize" INTEGER NOT NULL DEFAULT 24,
    "fontFamily" TEXT NOT NULL DEFAULT 'Poppins',
    "fontWeight" TEXT NOT NULL DEFAULT 'normal',
    "fontStyle" TEXT NOT NULL DEFAULT 'normal',
    "textDecoration" TEXT NOT NULL DEFAULT 'none',
    "color" TEXT NOT NULL DEFAULT '#000000',
    "textAlign" TEXT NOT NULL DEFAULT 'center',
    "zIndex" INTEGER NOT NULL DEFAULT 1,
    "textStroke" TEXT,
    "textShadow" TEXT,
    "borderWidth" DOUBLE PRECISION,
    "borderColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remix_text_boxes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "remix_posts_originalPostId_idx" ON "public"."remix_posts"("originalPostId");

-- CreateIndex
CREATE INDEX "remix_slides_remixPostId_idx" ON "public"."remix_slides"("remixPostId");

-- CreateIndex
CREATE INDEX "remix_text_boxes_slideId_idx" ON "public"."remix_text_boxes"("slideId");

-- CreateIndex
CREATE INDEX "tiktok_posts_ocrStatus_idx" ON "public"."tiktok_posts"("ocrStatus");

-- AddForeignKey
ALTER TABLE "public"."remix_posts" ADD CONSTRAINT "remix_posts_originalPostId_fkey" FOREIGN KEY ("originalPostId") REFERENCES "public"."tiktok_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."remix_slides" ADD CONSTRAINT "remix_slides_remixPostId_fkey" FOREIGN KEY ("remixPostId") REFERENCES "public"."remix_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."remix_text_boxes" ADD CONSTRAINT "remix_text_boxes_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "public"."remix_slides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
