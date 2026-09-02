import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JobsService } from '../jobs/jobs.service';

export interface EnqueueExtractionInput {
  filename: string;
  storagePath: string;
  mimeType: string;
  contentHash: string;
}

@Injectable()
export class ExtractionQueueService {
  constructor(
    @InjectQueue('extraction') private readonly queue: Queue,
    private readonly jobsService: JobsService,
  ) {}

  async enqueue(input: EnqueueExtractionInput): Promise<{ jobId: string; deduped: boolean }> {
    // Idempotency key = hash isi file: upload yang sama (double-submit,
    // klien retry karena network timeout, dsb) tidak bikin job/panggilan
    // model baru -- cukup arahkan ke job yang sudah/sedang jalan.
    const existing = await this.jobsService.findActiveByHash(input.contentHash);
    if (existing) {
      return { jobId: existing.id, deduped: true };
    }

    const job = await this.jobsService.create(input);

    // ID job Prisma dipakai juga sebagai ID job BullMQ -- satu ID buat
    // dua sistem, jadi GET /jobs/:id tidak butuh tabel mapping terpisah.
    await this.queue.add('extract', { jobId: job.id }, { jobId: job.id });

    return { jobId: job.id, deduped: false };
  }
}
