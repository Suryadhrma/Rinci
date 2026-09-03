import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Prisma } from '@prisma/client';
import { JobsService } from './jobs.service';
import { ReviewDatasetService } from './review-dataset.service';
import { receiptSchemaV1 } from '../extraction/schema/schema.v1';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly reviewDatasetService: ReviewDatasetService,
  ) {}

  @Get()
  async findAll(@Query('needsReview') needsReview?: string, @Query('limit') limit?: string) {
    const jobs = await this.jobsService.list({
      needsReview: needsReview === undefined ? undefined : needsReview === 'true',
      limit: limit ? Number(limit) : undefined,
    });

    // Daftar sengaja ringkas (bukan full result/confidence per field) --
    // buat review queue cuma butuh cukup buat memutuskan mana yang mau dibuka.
    return jobs.map((job) => ({
      id: job.id,
      status: job.status,
      filename: job.filename,
      needsReview: job.needsReview,
      reviewed: job.reviewedAt != null,
      confidenceScore: (job.confidence as { overallScore?: number } | null)?.overallScore ?? null,
      modelName: job.modelName,
      costUsd: job.costUsd,
      createdAt: job.createdAt,
    }));
  }

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
      correctedResult: job.correctedResult,
      reviewedAt: job.reviewedAt,
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

  @Get(':id/image')
  async getImage(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const job = await this.jobsService.findById(id);

    let buffer: Buffer;
    try {
      buffer = await readFile(resolve(job.storagePath));
    } catch {
      // Jangan bocorkan storagePath/error fs asli ke klien.
      throw new NotFoundException('File gambar untuk job ini sudah tidak ada di disk');
    }

    res.type(job.mimeType).send(buffer);
  }

  @Post(':id/correction')
  async submitCorrection(@Param('id') id: string, @Body() body: unknown) {
    const parsed = receiptSchemaV1.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Koreksi tidak sesuai skema',
        issues: parsed.error.issues,
      });
    }

    const job = await this.jobsService.findById(id);
    const updated = await this.jobsService.submitCorrection(id, parsed.data as Prisma.InputJsonValue);
    await this.reviewDatasetService.appendCorrection(job, parsed.data);

    return { id: updated.id, reviewedAt: updated.reviewedAt };
  }
}
