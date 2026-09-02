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
    const dbJob = await this.jobsService.findById(jobId);
    await this.jobsService.markProcessing(jobId);

    try {
      const buffer = await readFile(dbJob.storagePath);
      const result = await this.extractionService.extract(buffer, dbJob.mimeType);

      await this.jobsService.markCompleted(
        jobId,
        result.data as Prisma.InputJsonValue,
        result.meta.modelName,
      );
      this.logger.log(`Job ${jobId} selesai (model=${result.meta.modelName})`);
    } catch (err) {
      await this.jobsService.markFailed(jobId, String(err));
      this.logger.error(`Job ${jobId} gagal: ${String(err)}`);
      throw err; // biar BullMQ catat attempt gagal & jalankan retry sesuai defaultJobOptions
    }
  }
}
