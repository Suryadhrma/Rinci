import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { readFile } from 'node:fs/promises';
import type { Prisma } from '@prisma/client';
import { ExtractionService } from './extraction.service';
import { JobsService } from '../jobs/jobs.service';

interface ExtractionJobData {
  jobId: string;
}

@Processor('extraction')
export class ExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(ExtractionProcessor.name);

  constructor(
    private readonly extractionService: ExtractionService,
    private readonly jobsService: JobsService,
  ) {
    super();
  }

  async process(job: Job<ExtractionJobData>): Promise<void> {
    const { jobId } = job.data;

    try {
      const dbJob = await this.jobsService.findById(jobId);
      await this.jobsService.markProcessing(jobId);

      const buffer = await readFile(dbJob.storagePath);
      const result = await this.extractionService.extract(buffer, dbJob.mimeType);

      await this.jobsService.markCompleted(jobId, {
        result: result.data as Prisma.InputJsonValue,
        modelName: result.meta.modelName,
        confidence: result.confidence as unknown as Prisma.InputJsonValue,
        needsReview: result.confidence.needsReview,
        inputTokens: result.meta.inputTokens,
        outputTokens: result.meta.outputTokens,
        costUsd: result.meta.costUsd,
        durationMs: result.meta.durationMs,
        escalated: result.meta.escalated,
        repaired: result.meta.repaired,
      });
      this.logger.log(
        `Job ${jobId} selesai (model=${result.meta.modelName}, costUsd=${result.meta.costUsd ?? 'n/a'}, ` +
          `confidence=${result.confidence.overallScore}, needsReview=${result.confidence.needsReview})`,
      );
    } catch (err) {
      // job.attemptsMade belum kehitung attempt yang lagi jalan ini --
      // +1 buat tahu apa ini percobaan terakhir. Kalau masih ada retry
      // berikutnya, biarkan status Postgres tetap PROCESSING (bukan
      // FAILED) supaya GET /jobs/:id tidak nunjukkin gagal padahal masih
      // dicoba ulang di background.
      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;

      if (isFinalAttempt) {
        // markFailed sendiri bisa gagal (mis. job row memang tidak ada) --
        // itu tetap percobaan terakhir, cukup dicatat, jangan sampai
        // menutupi error asli yang mau dilempar ulang di bawah.
        await this.jobsService.markFailed(jobId, String(err)).catch((markErr: unknown) => {
          this.logger.error(`Gagal update status FAILED buat job ${jobId}: ${String(markErr)}`);
        });
        this.logger.error(`Job ${jobId} gagal total setelah ${maxAttempts} percobaan: ${String(err)}`);
      } else {
        this.logger.warn(
          `Job ${jobId} gagal (percobaan ${job.attemptsMade + 1}/${maxAttempts}), akan di-retry: ${String(err)}`,
        );
      }

      throw err; // biar BullMQ catat attempt gagal & jalankan retry sesuai defaultJobOptions
    }
  }
}
