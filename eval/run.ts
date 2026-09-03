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
  modelName?: string;
  escalated?: boolean;
  costUsd?: number | null;
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

  for (let i = 0; i < filenames.length; i++) {
    const filename = filenames[i];
    process.stdout.write(`  [${i + 1}/${filenames.length}] ${filename}... `);

    try {
      const buffer = readFileSync(join(dataDir, filename));
      const mimeType = detectImageMimeType(buffer);
      if (!mimeType) throw new Error('mime type tidak terdeteksi dari isi file');

      const result = await extractionService.extract(buffer, mimeType);
      const comparisons = compareExtraction(groundTruth[filename], result.data);
      allComparisons.push(comparisons);

      const mismatches = comparisons.filter((c) => !c.match);
      perSample.push({
        filename,
        mismatches,
        modelName: result.meta.modelName,
        escalated: result.meta.escalated,
        costUsd: result.meta.costUsd,
      });
      console.log(
        `ok (${mismatches.length} mismatch dari ${comparisons.length} field dicek, model=${result.meta.modelName}` +
          `${result.meta.escalated ? ', escalated' : ''})`,
      );
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

  // Ringkasan biaya/routing (Tahap 5) -- sampel yang GAGAL tidak punya
  // costUsd/modelName, cukup dilewat, bukan dianggap $0.
  const okSamples = perSample.filter((s) => !s.error);
  const modelCounts: Record<string, number> = {};
  for (const s of okSamples) {
    if (s.modelName) modelCounts[s.modelName] = (modelCounts[s.modelName] ?? 0) + 1;
  }
  const escalatedCount = okSamples.filter((s) => s.escalated).length;
  const costs = okSamples.map((s) => s.costUsd).filter((c): c is number => c != null);
  const totalCostUsd = costs.length ? Number(costs.reduce((a, b) => a + b, 0).toFixed(6)) : null;
  const avgCostUsdPerDoc = costs.length ? Number((costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(6)) : null;

  console.log('\n=== Biaya & routing model ===');
  console.log(`  model dipakai: ${JSON.stringify(modelCounts)}`);
  console.log(`  eskalasi: ${escalatedCount}/${okSamples.length} sampel`);
  console.log(`  total biaya (tarif berbayar, bukan riil -- free tier): $${totalCostUsd ?? 'n/a'}`);
  console.log(`  rata-rata biaya/dokumen: $${avgCostUsdPerDoc ?? 'n/a'}`);

  const promptHash = createHash('sha256').update(extractionPromptV1).digest('hex').slice(0, 8);
  // Nama file harus filesystem-safe (Windows tidak izinkan ":" di nama
  // file) -- tapi field "timestamp" DI DALAM JSON tetap ISO 8601 asli,
  // biar `new Date(run.timestamp)` di dashboard.html bisa nge-parse
  // (versi filesystem-safe bikin "Invalid Date", ditemukan pas testing).
  const timestamp = new Date().toISOString();
  const timestampSafe = timestamp.replace(/[:.]/g, '-');
  const runDir = join('eval', 'runs');
  mkdirSync(runDir, { recursive: true });
  const runPath = join(runDir, `${timestampSafe}__${promptHash}.json`);

  writeFileSync(
    runPath,
    JSON.stringify(
      {
        timestamp,
        models: modelCounts,
        promptVersion: 'v1',
        promptHash,
        split,
        sampleCount: filenames.length,
        fieldAccuracy: tally,
        overall: { matched: totalMatched, total: totalCompared, pct: Number(overallPct.toFixed(1)) },
        cost: { totalCostUsd, avgCostUsdPerDoc, escalatedCount, sampleCount: okSamples.length },
        perSample,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`\nHasil run tersimpan di ${runPath}`);
}

main()
  .then(() => process.exit(0)) // koneksi Redis dari QueueModule tidak nutup sendiri, proses jadi nggantung tanpa ini
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
