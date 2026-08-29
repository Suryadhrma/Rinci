import { Module } from '@nestjs/common';
import { ExtractionController } from './extraction.controller';
import { ExtractionService } from './extraction.service';
import { EXTRACTION_PROVIDER } from './providers/extraction-provider.interface';
import { GeminiExtractionProvider } from './providers/gemini.provider';
import { LocalStorageService } from '../storage/local-storage.service';

@Module({
  controllers: [ExtractionController],
  providers: [
    ExtractionService,
    LocalStorageService,
    // Ganti implementasi di sini kalau mau coba adapter lain (mis. OpenAI)
    // ExtractionService tidak perlu diubah sama sekali.
    { provide: EXTRACTION_PROVIDER, useClass: GeminiExtractionProvider },
  ],
})
export class ExtractionModule {}
