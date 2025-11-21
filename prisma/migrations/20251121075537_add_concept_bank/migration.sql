-- CreateEnum
CREATE TYPE "ConceptCategory" AS ENUM ('ALGORITHM_MECHANICS', 'ENGAGEMENT', 'CONTENT_STRATEGY', 'MISTAKES', 'MINDSET', 'HIDDEN_FEATURES');

-- CreateEnum
CREATE TYPE "ConceptSource" AS ENUM ('EXTRACTED', 'CURATED', 'WEB_SCRAPED');

-- CreateEnum
CREATE TYPE "ConceptFreshness" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "concept_bank" (
    "id" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "insiderTerm" TEXT,
    "explanation" TEXT NOT NULL,
    "consequence" TEXT,
    "viralAngle" TEXT,
    "proofPhrase" TEXT,
    "credibilitySource" TEXT,
    "category" "ConceptCategory" NOT NULL DEFAULT 'ALGORITHM_MECHANICS',
    "source" "ConceptSource" NOT NULL DEFAULT 'EXTRACTED',
    "sourcePostIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "freshness" "ConceptFreshness" NOT NULL DEFAULT 'HIGH',
    "conceptHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "concept_bank_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "concept_bank_conceptHash_key" ON "concept_bank"("conceptHash");

-- CreateIndex
CREATE INDEX "concept_bank_category_idx" ON "concept_bank"("category");

-- CreateIndex
CREATE INDEX "concept_bank_source_idx" ON "concept_bank"("source");

-- CreateIndex
CREATE INDEX "concept_bank_freshness_idx" ON "concept_bank"("freshness");

-- CreateIndex
CREATE INDEX "concept_bank_isActive_freshness_idx" ON "concept_bank"("isActive", "freshness");

-- CreateIndex
CREATE INDEX "concept_bank_timesUsed_idx" ON "concept_bank"("timesUsed");
