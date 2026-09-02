import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { JobsModule } from './jobs/jobs.module';
import { QueueModule } from './queue/queue.module';
import { ExtractionModule } from './extraction/extraction.module';
import { ExtractionProcessor } from './extraction/extraction.processor';

// Root module proses worker -- terpisah dari AppModule (proses API) supaya
// keduanya bisa di-deploy/scale independen, sesuai Tahap 2 roadmap.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QueueModule,
    JobsModule,
    ExtractionModule,
  ],
  providers: [ExtractionProcessor],
})
export class WorkerModule {}
