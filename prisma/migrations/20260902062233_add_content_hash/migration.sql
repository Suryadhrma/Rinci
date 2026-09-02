-- AlterTable: kolom ditambah nullable dulu, backfill baris lama (data
-- smoke-test, bukan data asli) dengan placeholder, baru diwajibkan NOT
-- NULL -- supaya tidak perlu hapus baris yang sudah ada.
ALTER TABLE "ExtractionJob" ADD COLUMN     "contentHash" TEXT;
UPDATE "ExtractionJob" SET "contentHash" = '' WHERE "contentHash" IS NULL;
ALTER TABLE "ExtractionJob" ALTER COLUMN "contentHash" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ExtractionJob_contentHash_idx" ON "ExtractionJob"("contentHash");
