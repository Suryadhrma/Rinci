import { NestFactory } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppModule as AppModuleType } from '../src/app.module';
import { extractionPromptV1 } from '../src/extraction/prompts/v1';
import { detectImageMimeType } from '../src/extraction/file-validation';
import type { ExtractionService as ExtractionServiceType } from '../src/extraction/extraction.service';
import { compareExtraction, tallyByField, type FieldComparison } from './scoring';

// tsx (esbuild) tidak emit decorator metadata, padahal DI Nest butuh itu
// buat resolve dependency constructor by type (mis. ConfigService di
// GeminiExtractionProvider). Jadi ambil kelas yang sudah dikompilasi tsc
// (di dist/, decorator metadata-nya sudah ke-emit) buat runtime-nya;
// tipe tetap dari src/ biar type-safe.
const { AppModule } = require('../dist/app.module') as { AppModule: typeof AppModuleType };
const { ExtractionService } = require('../dist/extraction/extraction.service') as {
  ExtractionService: typeof ExtractionServiceType;
};

interface CliArgs {
  n: number;
  split: string;
  delayMs: number;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback: string): string => {
    const i = args.indexOf(flag);
    return i === -1 ? fallback : args[i + 1];
  };
  return {
    n: Number(get('--n', '20')),
    split: get('--split', 'test'),
    // Default 13 detik: free tier gemini-3.5-flash cuma 5 request/menit
    // (lihat docs/notes/tahap-0-hasil.md) -- retry generik provider
    // terlalu pendek buat nunggu quota reset, jadi eval harness harus
    // throttle sendiri di sini.
    delayMs: Number(get('--delay-ms', '13000')),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SampleResult {
  filename: string;
  mismatches: FieldComparison[];
  error?: string;
}

async function main(): Promise<void> {
  const { n, split, delayMs } = parseArgs();
  const dataDir = join('data', 'cord', split);
  const groundTruthPath = join(dataDir, 'ground_truth.json');

  if (!existsSync(groundTruthPath)) {
    console.error(`Ground truth tidak ada di ${groundTruthPath}. Jalankan scripts/prepare_dataset.py dulu.`);
    process.exit(1);
  }

  const groundTruth = JSON.parse(readFileSync(groundTruthPath, 'utf-8')) as Record<string, unknown>;
  const filenames = Object.keys(groundTruth).sort().slice(0, n);

  if (filenames.length === 0) {
    console.error('Tidak ada sampel di ground_truth.json.');
    process.exit(1);
  }

  console.log(`Menjalankan eval untuk ${filenames.length} sampel dari split '${split}' (jeda ${delayMs}ms/request)...\n`);

  const appContext = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const extractionService = appContext.get(ExtractionService);

  const allComparisons: FieldComparison[][] = [];
  const perSample: SampleResult[] = [];
  let modelName: string | undefined;

  for (let i = 0; i < filenames.length; i++) {
    const filename = filenames[i];
    process.stdout.write(`  [${i + 1}/${filenames.length}] ${filename}... `);

    try {
      const buffer = readFileSync(join(dataDir, filename));
      const mimeType = detectImageMimeType(buffer);
      if (!mimeType) throw new Error('mime type tidak terdeteksi dari isi file');

      const result = await extractionService.extract(buffer, mimeType);
      modelName ??= result.meta.modelName;
      const comparisons = compareExtraction(groundTruth[filename], result.data);
      allComparisons.push(comparisons);

      const mismatches = comparisons.filter((c) => !c.match);
      perSample.push({ filename, mismatches });
      console.log(`ok (${mismatches.length} mismatch dari ${comparisons.length} field dicek)`);
    } catch (err) {
      perSample.push({ filename, mismatches: [], error: String(err) });
      console.log(`GAGAL: ${String(err)}`);
    }

    if (i < filenames.length - 1) await sleep(delayMs);
  }

  await appContext.close();

  const tally = tallyByField(allComparisons);
  const totalMatched = tally.reduce((sum, t) => sum + t.matched, 0);
  const totalCompared = tally.reduce((sum, t) => sum + t.total, 0);

  console.log('\n=== Akurasi per field ===');
  for (const t of tally) {
    const pct = t.total ? ((t.matched / t.total) * 100).toFixed(1) : '0.0';
    console.log(`  ${t.field.padEnd(20)} ${t.matched}/${t.total} (${pct}%)`);
  }
  const overallPct = totalCompared ? (totalMatched / totalCompared) * 100 : 0;
  console.log(`\nOVERALL: ${totalMatched}/${totalCompared} (${overallPct.toFixed(1)}%)`);

  const promptHash = createHash('sha256').update(extractionPromptV1).digest('hex').slice(0, 8);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = join('eval', 'runs');
  mkdirSync(runDir, { recursive: true });
  const runPath = join(runDir, `${timestamp}__${promptHash}.json`);

  writeFileSync(
    runPath,
    JSON.stringify(
      {
        timestamp,
        model: modelName ?? null,
        promptVersion: 'v1',
        promptHash,
        split,
        sampleCount: filenames.length,
        fieldAccuracy: tally,
        overall: { matched: totalMatched, total: totalCompared, pct: Number(overallPct.toFixed(1)) },
        perSample,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`\nHasil run tersimpan di ${runPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
