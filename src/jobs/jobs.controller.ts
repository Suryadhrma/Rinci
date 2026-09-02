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
      error: job.error,
      modelName: job.modelName,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}
