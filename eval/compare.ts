import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FieldTally } from './scoring';

interface RunFile {
  timestamp: string;
  models?: Record<string, number>;
  split: string;
  sampleCount: number;
  fieldAccuracy: FieldTally[];
  overall: { matched: number; total: number; pct: number };
  cost?: {
    totalCostUsd: number | null;
    avgCostUsdPerDoc: number | null;
    escalatedCount: number;
    sampleCount: number;
  };
}

function loadRun(path: string): RunFile {
  return JSON.parse(readFileSync(path, 'utf-8')) as RunFile;
}

function resolveRunPath(arg: string): string {
  if (existsSync(arg)) return arg;
  const candidate = join('eval', 'runs', arg);
  if (existsSync(candidate)) return candidate;
  throw new Error(`Run file tidak ditemukan: ${arg}`);
}

function pct(matched: number, total: number): number {
  return total ? (matched / total) * 100 : 0;
}

function formatDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}pp`;
}

function main(): void {
  const [argA, argB] = process.argv.slice(2);
  if (!argA || !argB) {
    console.error('Usage: npm run eval:compare -- <runA.json> <runB.json>');
    console.error('(nama file di eval/runs/ saja juga boleh, tidak perlu path lengkap)');
    process.exit(1);
  }

  const runA = loadRun(resolveRunPath(argA));
  const runB = loadRun(resolveRunPath(argB));

  console.log(`Run A: ${argA}`);
  console.log(`  ${runA.timestamp} | split=${runA.split} | n=${runA.sampleCount} | model=${JSON.stringify(runA.models ?? 'n/a (run lama)')}`);
  console.log(`Run B: ${argB}`);
  console.log(`  ${runB.timestamp} | split=${runB.split} | n=${runB.sampleCount} | model=${JSON.stringify(runB.models ?? 'n/a (run lama)')}`);

  console.log('\n=== Akurasi per field (A -> B) ===');
  const fieldsA = new Map(runA.fieldAccuracy.map((f) => [f.field, f]));
  const fieldsB = new Map(runB.fieldAccuracy.map((f) => [f.field, f]));
  const allFields = [...new Set([...fieldsA.keys(), ...fieldsB.keys()])].sort();

  for (const field of allFields) {
    const a = fieldsA.get(field);
    const b = fieldsB.get(field);
    const pctA = a ? pct(a.matched, a.total) : 0;
    const pctB = b ? pct(b.matched, b.total) : 0;
    console.log(`  ${field.padEnd(20)} ${pctA.toFixed(1)}% -> ${pctB.toFixed(1)}% (${formatDelta(pctB - pctA)})`);
  }

  const deltaOverall = runB.overall.pct - runA.overall.pct;
  console.log(`\nOVERALL: ${runA.overall.pct}% -> ${runB.overall.pct}% (${formatDelta(deltaOverall)})`);

  if (runA.cost && runB.cost) {
    const costA = runA.cost.avgCostUsdPerDoc;
    const costB = runB.cost.avgCostUsdPerDoc;

    console.log('\n=== Biaya (tarif berbayar resmi, bukan tagihan riil -- free tier) ===');
    console.log(`  rata-rata biaya/dokumen: $${costA ?? 'n/a'} -> $${costB ?? 'n/a'}`);

    if (costA != null && costB != null && costA > 0) {
      const savingsPct = ((costA - costB) / costA) * 100;
      const label = savingsPct >= 0 ? 'lebih hemat' : 'lebih mahal';
      console.log(`  B ${label} ${Math.abs(savingsPct).toFixed(1)}% dibanding A`);
    }

    console.log(`  eskalasi: ${runA.cost.escalatedCount}/${runA.cost.sampleCount} -> ${runB.cost.escalatedCount}/${runB.cost.sampleCount} sampel`);
  } else {
    console.log('\n(Salah satu run tidak punya data biaya -- run dari sebelum Tahap 5, tidak bisa dibandingkan biayanya.)');
  }
}

main();
