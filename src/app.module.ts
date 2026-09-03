import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ExtractionModule } from './extraction/extraction.module';
import { ExtractionProcessor } from './extraction/extraction.processor';
import { PrismaModule } from './prisma/prisma.module';
import { JobsModule } from './jobs/jobs.module';
import { EvalDashboardModule } from './eval-dashboard/eval-dashboard.module';
import { MetricsModule } from './metrics/metrics.module';
import { CleanupService } from './jobs/cleanup.service';

// RUN_WORKER_IN_PROCESS=true gabungin worker (consumer queue + cron
// cleanup, biasanya src/worker.ts) ke proses API yang sama -- buat
// deploy di tier gratis yang cuma kasih SATU proses tanpa kartu kredit
// (mis. Render Web Service tanpa Background Worker). Default (kosong):
// worker tetap proses terpisah sesuai desain awal Tahap 2 -- opsi ini
// cuma buat kondisi platform yang benar-benar terbatas, bukan pengganti.
const runWorkerInProcess = process.env.RUN_WORKER_IN_PROCESS === 'true';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limit dasar per-IP (wajib per CLAUDE.md, sebelumnya belum ada).
    // Default longgar buat pemakaian normal; endpoint upload dibatasi
    // lebih ketat lewat @Throttle() di ExtractionController -- itu yang
    // manggil API berbayar & paling gampang disalahgunakan.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    ...(runWorkerInProcess ? [ScheduleModule.forRoot()] : []),
    PrismaModule,
    JobsModule,
    ExtractionModule,
    EvalDashboardModule,
    MetricsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    ...(runWorkerInProcess ? [ExtractionProcessor, CleanupService] : []),
  ],
})
export class AppModule {}
