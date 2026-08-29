import { Inject, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import {
  EXTRACTION_PROVIDER,
  ExtractionProvider,
} from './providers/extraction-provider.interface';
import { receiptSchemaV1, ReceiptV1 } from './schema/schema.v1';
import { extractionPromptV1 } from './prompts/v1';

export interface ExtractResult {
  data: ReceiptV1;
  meta: {
    modelName: string;
    promptVersion: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
  };
}

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);

  constructor(
    @Inject(EXTRACTION_PROVIDER) private readonly provider: ExtractionProvider,
  ) {}

  async extract(imageBuffer: Buffer, mimeType: string): Promise<ExtractResult> {
    const result = await this.provider.extract({
      imageBuffer,
      mimeType,
      prompt: extractionPromptV1,
    });

    const parsed = receiptSchemaV1.safeParse(result.raw);
    if (!parsed.success) {
      this.logger.error(`Output model gagal validasi skema: ${parsed.error.message}`);
      throw new UnprocessableEntityException({
        message: 'Model mengembalikan data yang tidak sesuai skema',
        issues: parsed.error.issues,
      });
    }

    this.logger.log(
      `extract selesai | provider=${this.provider.name} model=${result.modelName} ` +
        `promptVersion=v1 inputTokens=${result.inputTokens} outputTokens=${result.outputTokens} ` +
        `durasi=${result.durationMs}ms`,
    );

    return {
      data: parsed.data,
      meta: {
        modelName: result.modelName,
        promptVersion: 'v1',
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        durationMs: result.durationMs,
      },
    };
  }
}
