import { Module } from '@nestjs/common';
import { ExtractionController } from './extraction.controller';
import { ExtractionService } from './extraction.service';
import { ExtractionQueueService } from './extraction-queue.service';
import { EXTRACTION_PROVIDER } from './providers/extraction-provider.interface';
import { GeminiExtractionProvider } from './providers/gemini.provider';
import { LocalStorageService } from '../storage/local-storage.service';
import { QueueModule } from '../queue/queue.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [QueueModule, JobsModule],
  controllers: [ExtractionController],
  providers: [
    ExtractionService,
    ExtractionQueueService,
    LocalStorageService,
    // Ganti implementasi di sini kalau mau coba adapter lain (mis. OpenAI)
    // ExtractionService tidak perlu diubah sama sekali.
    { provide: EXTRACTION_PROVIDER, useClass: GeminiExtractionProvider },
  ],
  exports: [ExtractionService],
})
export class ExtractionModule {}
