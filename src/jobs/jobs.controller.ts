import { Controller, Get, Param } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const job = await this.jobsService.findById(id);

    // storagePath sengaja tidak diikutkan di response -- itu path internal
    // disk server, bukan sesuatu yang perlu dilihat klien.
    return {
      id: job.id,
      status: job.status,
      filename: job.filename,
      result: job.result,
      confidence: job.confidence,
      needsReview: job.needsReview,
      error: job.error,
      modelName: job.modelName,
      escalated: job.escalated,
      repaired: job.repaired,
      usage: {
        inputTokens: job.inputTokens,
        outputTokens: job.outputTokens,
        costUsd: job.costUsd,
        durationMs: job.durationMs,
      },
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}
