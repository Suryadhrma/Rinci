-- AlterTable
ALTER TABLE "ExtractionJob" ADD COLUMN     "correctedResult" JSONB,
ADD COLUMN     "reviewedAt" TIMESTAMP(3);
