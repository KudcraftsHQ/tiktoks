-- AlterTable
ALTER TABLE "public"."carousels" ADD COLUMN     "authorAvatar" TEXT,
ADD COLUMN     "authorHandle" TEXT,
ADD COLUMN     "commentCount" INTEGER DEFAULT 0,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "likeCount" INTEGER DEFAULT 0,
ADD COLUMN     "saveCount" INTEGER DEFAULT 0,
ADD COLUMN     "shareCount" INTEGER DEFAULT 0,
ADD COLUMN     "tags" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "viewCount" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."carousel_variations" (
    "id" TEXT NOT NULL,
    "carouselId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isOriginal" BOOLEAN NOT NULL DEFAULT false,
    "generationType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carousel_variations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."carousel_slides" (
    "id" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "backgroundImageUrl" TEXT,
    "backgroundImagePositionX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "backgroundImagePositionY" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "backgroundImageZoom" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carousel_slides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."carousel_text_boxes" (
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carousel_text_boxes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "carousel_variations_carouselId_idx" ON "public"."carousel_variations"("carouselId");

-- CreateIndex
CREATE INDEX "carousel_slides_variationId_idx" ON "public"."carousel_slides"("variationId");

-- CreateIndex
CREATE INDEX "carousel_text_boxes_slideId_idx" ON "public"."carousel_text_boxes"("slideId");

-- AddForeignKey
ALTER TABLE "public"."carousel_variations" ADD CONSTRAINT "carousel_variations_carouselId_fkey" FOREIGN KEY ("carouselId") REFERENCES "public"."carousels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carousel_slides" ADD CONSTRAINT "carousel_slides_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "public"."carousel_variations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carousel_text_boxes" ADD CONSTRAINT "carousel_text_boxes_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "public"."carousel_slides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
