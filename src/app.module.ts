import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ExtractionModule } from './extraction/extraction.module';
import { PrismaModule } from './prisma/prisma.module';
import { JobsModule } from './jobs/jobs.module';
import { EvalDashboardModule } from './eval-dashboard/eval-dashboard.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limit dasar per-IP (wajib per CLAUDE.md, sebelumnya belum ada).
    // Default longgar buat pemakaian normal; endpoint upload dibatasi
    // lebih ketat lewat @Throttle() di ExtractionController -- itu yang
    // manggil API berbayar & paling gampang disalahgunakan.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    JobsModule,
    ExtractionModule,
    EvalDashboardModule,
    MetricsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
