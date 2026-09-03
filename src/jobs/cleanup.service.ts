import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { unlink } from 'node:fs/promises';
import { PrismaService } from '../prisma/prisma.service';

// Demo publik (Tahap 7): file dokumen pengunjung dihapus otomatis
// setelah beberapa jam -- itu foto struk orang lain, bukan sesuatu
// yang perlu disimpan selamanya di disk server. Row Postgres-nya TETAP
// disimpan (hasil ekstraksi, confidence, biaya) buat histori eval/
// dashboard -- yang dihapus cuma file gambarnya.
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);
  private readonly retentionHours: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.retentionHours = Number(config.get<string>('FILE_RETENTION_HOURS', '24'));
  }

  @Cron(CronExpression.EVERY_HOUR)
  async deleteOldFiles(): Promise<void> {
    const cutoff = new Date(Date.now() - this.retentionHours * 60 * 60 * 1000);

    const oldJobs = await this.prisma.extractionJob.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true, storagePath: true },
    });

    if (oldJobs.length === 0) return;

    let deletedCount = 0;
    for (const job of oldJobs) {
      try {
        await unlink(job.storagePath);
        deletedCount++;
      } catch {
        // File sudah tidak ada (dihapus sebelumnya, atau storage ephemeral
        // abis restart) -- bukan error yang perlu menghentikan cleanup.
      }
    }

    if (deletedCount > 0) {
      this.logger.log(`Cleanup: hapus ${deletedCount} file lebih lama dari ${this.retentionHours} jam`);
    }
  }
}
