import { Injectable, Logger } from '@nestjs/common';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtractionJob } from '@prisma/client';
import type { ReceiptV1 } from '../extraction/schema/schema.v1';

const CORRECTIONS_DIR = join('data', 'cord', 'corrections');
const GROUND_TRUTH_PATH = join(CORRECTIONS_DIR, 'ground_truth.json');

// Koreksi manusia lewat review queue otomatis jadi sampel eval baru
// (Tahap 6) -- dituliskan dengan format yang sama seperti
// scripts/prepare_dataset.py (map filename -> gt_parse-like object) biar
// bisa langsung dipakai `npm run eval -- --split corrections`.
@Injectable()
export class ReviewDatasetService {
  private readonly logger = new Logger(ReviewDatasetService.name);

  async appendCorrection(job: ExtractionJob, correctedResult: ReceiptV1): Promise<void> {
    await mkdir(CORRECTIONS_DIR, { recursive: true });

    const existing = existsSync(GROUND_TRUTH_PATH)
      ? (JSON.parse(await readFile(GROUND_TRUTH_PATH, 'utf-8')) as Record<string, unknown>)
      : {};

    existing[job.filename] = correctedResult;
    await writeFile(GROUND_TRUTH_PATH, JSON.stringify(existing, null, 2), 'utf-8');

    await copyFile(job.storagePath, join(CORRECTIONS_DIR, job.filename));

    this.logger.log(`Koreksi job ${job.id} ditambahkan ke dataset eval corrections (${job.filename})`);
  }
}
