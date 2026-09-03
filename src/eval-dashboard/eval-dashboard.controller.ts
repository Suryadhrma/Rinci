import { Controller, Get } from '@nestjs/common';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const RUNS_DIR = join('eval', 'runs');

// Dashboard eval (Tahap 6) -- baca langsung file JSON yang ditulis
// eval/run.ts, tidak ada penyimpanan terpisah. Hasil eval memang cuma
// dipakai lokal/CI, belum ada kebutuhan nyata buat masuk Postgres.
@Controller('eval')
export class EvalDashboardController {
  @Get('runs')
  async findAll() {
    let files: string[];
    try {
      files = await readdir(RUNS_DIR);
    } catch {
      return [];
    }

    const runs = await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map(async (file) => {
          const content = JSON.parse(await readFile(join(RUNS_DIR, file), 'utf-8')) as Record<string, unknown>;
          return { file, ...content } as { file: string; timestamp?: string } & Record<string, unknown>;
        }),
    );

    return runs.sort((a, b) => String(a.timestamp ?? '').localeCompare(String(b.timestamp ?? '')));
  }
}
