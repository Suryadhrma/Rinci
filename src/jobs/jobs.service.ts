import { Injectable, NotFoundException } from '@nestjs/common';
import { ExtractionJob, JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateJobInput {
  filename: string;
  storagePath: string;
  mimeType: string;
}

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateJobInput): Promise<ExtractionJob> {
    return this.prisma.extractionJob.create({
      data: {
        filename: input.filename,
        storagePath: input.storagePath,
        mimeType: input.mimeType,
      },
    });
  }

  async findById(id: string): Promise<ExtractionJob> {
    const job = await this.prisma.extractionJob.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException(`Job ${id} tidak ditemukan`);
    }
    return job;
  }

  markProcessing(id: string): Promise<ExtractionJob> {
    return this.prisma.extractionJob.update({
      where: { id },
      data: { status: JobStatus.PROCESSING },
    });
  }

  markCompleted(
    id: string,
    result: Prisma.InputJsonValue,
    modelName: string,
  ): Promise<ExtractionJob> {
    return this.prisma.extractionJob.update({
      where: { id },
      data: { status: JobStatus.COMPLETED, result, modelName },
    });
  }

  markFailed(id: string, error: string): Promise<ExtractionJob> {
    return this.prisma.extractionJob.update({
      where: { id },
      data: { status: JobStatus.FAILED, error },
    });
  }
}
