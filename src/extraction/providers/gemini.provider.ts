import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import {
  ExtractionProvider,
  ExtractionProviderInput,
  ExtractionProviderOutput,
} from './extraction-provider.interface';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class GeminiExtractionProvider implements ExtractionProvider {
  readonly name = 'gemini';

  private readonly logger = new Logger(GeminiExtractionProvider.name);
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(config: ConfigService) {
    const apiKey = config.getOrThrow<string>('GEMINI_API_KEY');
    this.model = config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
    this.client = new GoogleGenAI({ apiKey });
  }

  async extract(input: ExtractionProviderInput): Promise<ExtractionProviderOutput> {
    const startedAt = Date.now();
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await this.callWithTimeout(input);
        return this.toProviderOutput(response, Date.now() - startedAt);
      } catch (error) {
        lastError = error;

        if (!this.isRetryable(error) || attempt === MAX_ATTEMPTS) {
          break;
        }

        const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
        this.logger.warn(
          `Panggilan Gemini gagal (percobaan ${attempt}/${MAX_ATTEMPTS}), retry setelah ${delay}ms: ${String(error)}`,
        );
        await sleep(delay);
      }
    }

    throw lastError;
  }

  private async callWithTimeout(input: ExtractionProviderInput) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      return await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: input.prompt },
              {
                inlineData: {
                  mimeType: input.mimeType,
                  data: input.imageBuffer.toString('base64'),
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          abortSignal: controller.signal,
        },
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private toProviderOutput(
    response: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>,
    durationMs: number,
  ): ExtractionProviderOutput {
    const text = response.text;
    if (!text) {
      throw new Error('Gemini tidak mengembalikan output teks');
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error('Output Gemini bukan JSON valid');
    }

    return {
      raw,
      modelName: this.model,
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      durationMs,
    };
  }

  /** Cuma retry buat error transient (timeout, rate limit, 5xx) — bukan API key salah atau input invalid. */
  private isRetryable(error: unknown): boolean {
    if (error instanceof Error && error.name === 'AbortError') {
      return true;
    }

    const status = (error as { status?: number })?.status;
    return status === 429 || (typeof status === 'number' && status >= 500);
  }
}
