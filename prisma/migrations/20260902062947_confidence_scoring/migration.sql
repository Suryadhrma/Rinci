-- AlterTable
ALTER TABLE "ExtractionJob" ADD COLUMN     "confidence" JSONB,
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false;
