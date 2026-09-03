import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { JobsModule } from './jobs/jobs.module';
import { QueueModule } from './queue/queue.module';
import { ExtractionModule } from './extraction/extraction.module';
import { ExtractionProcessor } from './extraction/extraction.processor';
import { CleanupService } from './jobs/cleanup.service';

// Root module proses worker -- terpisah dari AppModule (proses API) supaya
// keduanya bisa di-deploy/scale independen, sesuai Tahap 2 roadmap.
// CleanupService (cron) sengaja di sini, bukan di AppModule -- kalau
// didaftar di keduanya, dua proses bakal jalanin cron yang sama tiap jam.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    QueueModule,
    JobsModule,
    ExtractionModule,
  ],
  providers: [ExtractionProcessor, CleanupService],
})
export class WorkerModule {}
