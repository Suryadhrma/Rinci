import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JobsService } from '../jobs/jobs.service';

export interface EnqueueExtractionInput {
  filename: string;
  storagePath: string;
  mimeType: string;
}

@Injectable()
export class ExtractionQueueService {
  constructor(
    @InjectQueue('extraction') private readonly queue: Queue,
    private readonly jobsService: JobsService,
  ) {}

  async enqueue(input: EnqueueExtractionInput): Promise<{ jobId: string }> {
    const job = await this.jobsService.create(input);

    // ID job Prisma dipakai juga sebagai ID job BullMQ -- satu ID buat
    // dua sistem, jadi GET /jobs/:id tidak butuh tabel mapping terpisah.
    await this.queue.add('extract', { jobId: job.id }, { jobId: job.id });

    return { jobId: job.id };
  }
}
