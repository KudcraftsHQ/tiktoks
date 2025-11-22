/*
  Warnings:

  - You are about to drop the column `category` on the `concept_bank` table. All the data in the column will be lost.
  - You are about to drop the column `concept` on the `concept_bank` table. All the data in the column will be lost.
  - You are about to drop the column `conceptHash` on the `concept_bank` table. All the data in the column will be lost.
  - You are about to drop the column `consequence` on the `concept_bank` table. All the data in the column will be lost.
  - You are about to drop the column `credibilitySource` on the `concept_bank` table. All the data in the column will be lost.
  - You are about to drop the column `explanation` on the `concept_bank` table. All the data in the column will be lost.
  - You are about to drop the column `freshness` on the `concept_bank` table. All the data in the column will be lost.
  - You are about to drop the column `insiderTerm` on the `concept_bank` table. All the data in the column will be lost.
  - You are about to drop the column `proofPhrase` on the `concept_bank` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `concept_bank` table. All the data in the column will be lost.
  - You are about to drop the column `sourcePostIds` on the `concept_bank` table. All the data in the column will be lost.
  - You are about to drop the column `viralAngle` on the `concept_bank` table. All the data in the column will be lost.
  - Added the required column `coreMessage` to the `concept_bank` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `concept_bank` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ConceptType" AS ENUM ('HOOK', 'CONTENT', 'CTA');

-- CreateEnum
CREATE TYPE "ExampleSourceType" AS ENUM ('SLIDE', 'MANUAL');

-- DropIndex
DROP INDEX "concept_bank_category_idx";

-- DropIndex
DROP INDEX "concept_bank_conceptHash_key";

-- DropIndex
DROP INDEX "concept_bank_freshness_idx";

-- DropIndex
DROP INDEX "concept_bank_isActive_freshness_idx";

-- DropIndex
DROP INDEX "concept_bank_source_idx";

-- AlterTable
ALTER TABLE "concept_bank" DROP COLUMN "category",
DROP COLUMN "concept",
DROP COLUMN "conceptHash",
DROP COLUMN "consequence",
DROP COLUMN "credibilitySource",
DROP COLUMN "explanation",
DROP COLUMN "freshness",
DROP COLUMN "insiderTerm",
DROP COLUMN "proofPhrase",
DROP COLUMN "source",
DROP COLUMN "sourcePostIds",
DROP COLUMN "viralAngle",
ADD COLUMN     "coreMessage" TEXT NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "type" "ConceptType" NOT NULL DEFAULT 'CONTENT';

-- DropEnum
DROP TYPE "ConceptCategory";

-- DropEnum
DROP TYPE "ConceptFreshness";

-- DropEnum
DROP TYPE "ConceptSource";

-- CreateTable
CREATE TABLE "concept_examples" (
    "id" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sourceType" "ExampleSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourcePostId" TEXT,
    "sourceSlideIndex" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concept_examples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "concept_examples_conceptId_idx" ON "concept_examples"("conceptId");

-- CreateIndex
CREATE INDEX "concept_examples_sourcePostId_idx" ON "concept_examples"("sourcePostId");

-- CreateIndex
CREATE INDEX "concept_bank_type_idx" ON "concept_bank"("type");

-- CreateIndex
CREATE INDEX "concept_bank_isActive_idx" ON "concept_bank"("isActive");

-- AddForeignKey
ALTER TABLE "concept_examples" ADD CONSTRAINT "concept_examples_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concept_bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;
