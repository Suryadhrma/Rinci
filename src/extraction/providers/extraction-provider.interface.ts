export interface ExtractionProviderInput {
  imageBuffer: Buffer;
  mimeType: string;
  prompt: string;
}

export interface ExtractionProviderOutput {
  /** Hasil parse JSON mentah dari model, BELUM divalidasi skema. */
  raw: unknown;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

/**
 * Kontrak yang harus dipenuhi setiap adapter model vision (Gemini, OpenAI, dst).
 * ExtractionService hanya bergantung pada interface ini, tidak tahu-menahu
 * SDK provider mana yang dipakai di baliknya.
 */
export interface ExtractionProvider {
  readonly name: string;
  extract(input: ExtractionProviderInput): Promise<ExtractionProviderOutput>;
}

/**
 * Interface TypeScript hilang saat dikompilasi ke JS, jadi NestJS tidak bisa
 * pakai tipe ExtractionProvider sebagai token DI. Symbol ini yang jadi token-nya:
 * didaftarkan di module lewat `provide: EXTRACTION_PROVIDER`, lalu di-inject
 * lewat `@Inject(EXTRACTION_PROVIDER)`.
 */
export const EXTRACTION_PROVIDER = Symbol('EXTRACTION_PROVIDER');
