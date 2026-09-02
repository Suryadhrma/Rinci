-- AlterTable
ALTER TABLE "ExtractionJob" ADD COLUMN     "costUsd" DOUBLE PRECISION,
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "escalated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inputTokens" INTEGER,
ADD COLUMN     "outputTokens" INTEGER,
ADD COLUMN     "repaired" BOOLEAN NOT NULL DEFAULT false;
