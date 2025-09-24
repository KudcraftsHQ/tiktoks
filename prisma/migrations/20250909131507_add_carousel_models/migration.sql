-- CreateTable
CREATE TABLE "public"."carousels" (
    "id" TEXT NOT NULL,
    "tiktokUrl" TEXT NOT NULL,
    "title" TEXT,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carousels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."carousel_images" (
    "id" TEXT NOT NULL,
    "carouselId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "displayOrder" INTEGER NOT NULL,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carousel_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carousels_tiktokUrl_key" ON "public"."carousels"("tiktokUrl");

-- CreateIndex
CREATE INDEX "carousel_images_carouselId_idx" ON "public"."carousel_images"("carouselId");

-- CreateIndex
CREATE INDEX "carousel_images_text_idx" ON "public"."carousel_images"("text");

-- AddForeignKey
ALTER TABLE "public"."carousel_images" ADD CONSTRAINT "carousel_images_carouselId_fkey" FOREIGN KEY ("carouselId") REFERENCES "public"."carousels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
