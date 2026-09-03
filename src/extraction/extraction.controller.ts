import {
  BadRequestException,
  Controller,
  HttpCode,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { createHash } from 'node:crypto';
import { ExtractionQueueService } from './extraction-queue.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { detectImageMimeType } from './file-validation';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

@ApiTags('extraction')
@Controller()
export class ExtractionController {
  constructor(
    private readonly extractionQueueService: ExtractionQueueService,
    private readonly storage: LocalStorageService,
  ) {}

  @Post('extract')
  @HttpCode(202)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  // Endpoint ini yang manggil API berbayar (Gemini) -- dibatasi lebih
  // ketat dari default global (5/menit per IP), biar satu klien tidak
  // bisa menghabiskan kuota/biaya sendirian.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Upload struk/nota, antre buat diekstrak' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 202, description: 'Job diterima, dikembalikan jobId buat polling GET /jobs/:id' })
  @ApiResponse({ status: 400, description: 'File bukan gambar JPEG/PNG/WebP yang valid' })
  @ApiResponse({ status: 429, description: 'Terlalu banyak request, coba lagi nanti' })
  async extract(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE_BYTES })],
      }),
    )
    file: Express.Multer.File,
  ) {
    // Cek isi file, bukan cuma percaya mimetype/nama yang diklaim si pengirim.
    const detectedMimeType = detectImageMimeType(file.buffer);
    if (!detectedMimeType) {
      throw new BadRequestException(
        'File bukan gambar JPEG/PNG/WebP yang valid (dicek dari isi file, bukan nama/ekstensi)',
      );
    }

    const saved = await this.storage.save(file);
    const contentHash = createHash('sha256').update(file.buffer).digest('hex');

    return this.extractionQueueService.enqueue({
      filename: saved.filename,
      storagePath: saved.path,
      mimeType: detectedMimeType,
      contentHash,
    });
  }
}
