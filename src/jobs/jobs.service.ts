import { Injectable, NotFoundException } from '@nestjs/common';
import { ExtractionJob, JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateJobInput {
  filename: string;
  storagePath: string;
  mimeType: string;
  contentHash: string;
}

export interface MarkCompletedInput {
  result: Prisma.InputJsonValue;
  modelName: string;
  confidence: Prisma.InputJsonValue;
  needsReview: boolean;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  durationMs: number;
  escalated: boolean;
  repaired: boolean;
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
        contentHash: input.contentHash,
      },
    });
  }

  // Idempotency: job lama dengan isi file sama yang masih relevan (belum
  // gagal total) dipakai ulang, bukan diproses dari nol lagi.
  findActiveByHash(contentHash: string): Promise<ExtractionJob | null> {
    return this.prisma.extractionJob.findFirst({
      where: {
        contentHash,
        status: { in: [JobStatus.QUEUED, JobStatus.PROCESSING, JobStatus.COMPLETED] },
      },
      orderBy: { createdAt: 'desc' },
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

  markCompleted(id: string, input: MarkCompletedInput): Promise<ExtractionJob> {
    return this.prisma.extractionJob.update({
      where: { id },
      data: { status: JobStatus.COMPLETED, ...input },
    });
  }

  markFailed(id: string, error: string): Promise<ExtractionJob> {
    return this.prisma.extractionJob.update({
      where: { id },
      data: { status: JobStatus.FAILED, error },
    });
  }
}
