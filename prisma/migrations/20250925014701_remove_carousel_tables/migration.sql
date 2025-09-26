/*
  Warnings:

  - You are about to drop the `carousel_images` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `carousel_slides` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `carousel_text_boxes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `carousel_variations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `carousels` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `remix_slides` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `remix_text_boxes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."carousel_images" DROP CONSTRAINT "carousel_images_carouselId_fkey";

-- DropForeignKey
ALTER TABLE "public"."carousel_slides" DROP CONSTRAINT "carousel_slides_variationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."carousel_text_boxes" DROP CONSTRAINT "carousel_text_boxes_slideId_fkey";

-- DropForeignKey
ALTER TABLE "public"."carousel_variations" DROP CONSTRAINT "carousel_variations_carouselId_fkey";

-- DropForeignKey
ALTER TABLE "public"."remix_slides" DROP CONSTRAINT "remix_slides_remixPostId_fkey";

-- DropForeignKey
ALTER TABLE "public"."remix_text_boxes" DROP CONSTRAINT "remix_text_boxes_slideId_fkey";

-- AlterTable
ALTER TABLE "public"."remix_posts" ADD COLUMN     "slides" JSONB NOT NULL DEFAULT '[]';

-- DropTable
DROP TABLE "public"."carousel_images";

-- DropTable
DROP TABLE "public"."carousel_slides";

-- DropTable
DROP TABLE "public"."carousel_text_boxes";

-- DropTable
DROP TABLE "public"."carousel_variations";

-- DropTable
DROP TABLE "public"."carousels";

-- DropTable
DROP TABLE "public"."remix_slides";

-- DropTable
DROP TABLE "public"."remix_text_boxes";
