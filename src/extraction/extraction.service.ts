import { Inject, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EXTRACTION_PROVIDER,
  ExtractionProvider,
} from './providers/extraction-provider.interface';
import { receiptSchemaV1, ReceiptV1 } from './schema/schema.v1';
import { extractionPromptV1 } from './prompts/v1';
import { buildRepairPromptV1 } from './prompts/repair';
import { scoreConfidence, ConfidenceResult } from './confidence/confidence';
import { calculateCostUsd } from './pricing';

export interface ExtractResult {
  data: ReceiptV1;
  confidence: ConfidenceResult;
  meta: {
    modelName: string;
    promptVersion: string;
    repaired: boolean;
    escalated: boolean;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    costUsd: number | null;
  };
}

interface CallAttempt {
  parsed: ReturnType<typeof receiptSchemaV1.safeParse>;
  modelName: string;
  repaired: boolean;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  costUsd: number | null;
}

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  private readonly escalationModel?: string;

  constructor(
    @Inject(EXTRACTION_PROVIDER) private readonly provider: ExtractionProvider,
    config: ConfigService,
  ) {
    // Model routing (Tahap 5): GEMINI_MODEL (default provider) dipakai
    // buat percobaan pertama yang murah; GEMINI_MODEL_ESCALATION cuma
    // dipanggil kalau confidence percobaan pertama di bawah ambang.
    // Kosong = eskalasi dimatikan, selalu pakai model default.
    this.escalationModel = config.get<string>('GEMINI_MODEL_ESCALATION') || undefined;
  }

  async extract(imageBuffer: Buffer, mimeType: string): Promise<ExtractResult> {
    const cheapAttempt = await this.callAndValidate(imageBuffer, mimeType, extractionPromptV1);

    if (!cheapAttempt.parsed.success) {
      this.logger.error(
        `Output model tetap gagal validasi skema setelah repair prompt: ${cheapAttempt.parsed.error.message}`,
      );
      throw new UnprocessableEntityException({
        message: 'Model mengembalikan data yang tidak sesuai skema (sudah dicoba repair prompt)',
        issues: cheapAttempt.parsed.error.issues,
      });
    }

    let finalData = cheapAttempt.parsed.data;
    let finalModelName = cheapAttempt.modelName;
    let finalConfidence = scoreConfidence(finalData);
    let escalated = false;

    let totalInputTokens = cheapAttempt.inputTokens;
    let totalOutputTokens = cheapAttempt.outputTokens;
    let totalDurationMs = cheapAttempt.durationMs;
    let totalCostUsd = cheapAttempt.costUsd;

    // Eskalasi: confidence model murah rendah -- coba lagi dengan model
    // yang lebih mahal/mampu, gambar sama. Ini panggilan model BENERAN
    // (bukan gratis), jadi token/biaya-nya tetap dijumlah walau hasil
    // model murah dibuang -- itu tetap biaya yang keluar.
    if (finalConfidence.needsReview && this.escalationModel) {
      this.logger.warn(
        `Confidence rendah (${finalConfidence.overallScore}) dari ${cheapAttempt.modelName}, eskalasi ke ${this.escalationModel}`,
      );

      const escalatedAttempt = await this.callAndValidate(
        imageBuffer,
        mimeType,
        extractionPromptV1,
        this.escalationModel,
      );

      totalInputTokens += escalatedAttempt.inputTokens;
      totalOutputTokens += escalatedAttempt.outputTokens;
      totalDurationMs += escalatedAttempt.durationMs;
      totalCostUsd =
        totalCostUsd == null || escalatedAttempt.costUsd == null
          ? null
          : totalCostUsd + escalatedAttempt.costUsd;

      if (escalatedAttempt.parsed.success) {
        finalData = escalatedAttempt.parsed.data;
        finalModelName = escalatedAttempt.modelName;
        finalConfidence = scoreConfidence(finalData);
        escalated = true;
      } else {
        this.logger.warn('Hasil eskalasi juga gagal validasi skema, tetap pakai hasil model murah.');
      }
    }

    this.logger.log(
      `extract selesai | provider=${this.provider.name} model=${finalModelName} ` +
        `promptVersion=v1 escalated=${escalated} inputTokens=${totalInputTokens} outputTokens=${totalOutputTokens} ` +
        `durasi=${totalDurationMs}ms costUsd=${totalCostUsd ?? 'n/a'} confidence=${finalConfidence.overallScore} ` +
        `needsReview=${finalConfidence.needsReview}`,
    );

    return {
      data: finalData,
      confidence: finalConfidence,
      meta: {
        modelName: finalModelName,
        promptVersion: 'v1',
        repaired: cheapAttempt.repaired,
        escalated,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        durationMs: totalDurationMs,
        costUsd: totalCostUsd,
      },
    };
  }

  // Satu "percobaan" lengkap: panggil model, kalau output gagal validasi
  // skema coba sekali lagi dengan repair prompt. Dipakai baik buat
  // percobaan model murah maupun eskalasi -- keduanya butuh alur yang sama.
  private async callAndValidate(
    imageBuffer: Buffer,
    mimeType: string,
    prompt: string,
    model?: string,
  ): Promise<CallAttempt> {
    const first = await this.provider.extract({ imageBuffer, mimeType, prompt, model });
    let parsed = receiptSchemaV1.safeParse(first.raw);
    let final = first;
    let repaired = false;

    if (!parsed.success) {
      this.logger.warn(`Output model gagal validasi skema, coba repair prompt sekali: ${parsed.error.message}`);

      const repairAttempt = await this.provider.extract({
        imageBuffer,
        mimeType,
        prompt: buildRepairPromptV1(first.raw, parsed.error.issues),
        model,
      });

      parsed = receiptSchemaV1.safeParse(repairAttempt.raw);
      final = repairAttempt;
      repaired = true;
    }

    const inputTokens = first.inputTokens + (repaired ? final.inputTokens : 0);
    const outputTokens = first.outputTokens + (repaired ? final.outputTokens : 0);
    const durationMs = first.durationMs + (repaired ? final.durationMs : 0);

    return {
      parsed,
      modelName: final.modelName,
      repaired,
      inputTokens,
      outputTokens,
      durationMs,
      costUsd: calculateCostUsd(final.modelName, inputTokens, outputTokens),
    };
  }
}
