import { Controller, Get } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

// Dead-letter queue: job yang gagal total (habis semua attempts di
// QueueModule) tetap tersimpan di set "failed" BullMQ (removeOnFail
// dibatasi, bukan dihapus langsung) -- endpoint ini buat meriksanya.
@Controller('jobs/dead-letter')
export class DeadLetterController {
  constructor(@InjectQueue('extraction') private readonly queue: Queue) {}

  @Get()
  async findAll() {
    const failedJobs = await this.queue.getFailed(0, 49);

    return failedJobs.map((job) => ({
      jobId: job.data?.jobId ?? job.id,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    }));
  }
}
