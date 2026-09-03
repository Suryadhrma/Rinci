import { Injectable } from '@nestjs/common';
import { Registry, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { PrismaService } from '../prisma/prisma.service';

// Sample terurut ascending -- p50/p95/p99 dibaca dari index-nya langsung
// (metode "nearest rank"), tanpa dependency statistik tambahan.
function percentile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  const index = Math.min(sortedAsc.length - 1, Math.ceil(q * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, index)];
}

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly httpRequestDuration: Histogram<string>;

  constructor(private readonly prisma: PrismaService) {
    collectDefaultMetrics({ register: this.registry }); // CPU, memory, event loop lag -- metrik proses standar Node

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Durasi request HTTP di proses API (bukan proses ekstraksi async di worker)',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    const prismaService = this.prisma;
    // Ekstraksi jalan async di proses worker (Tahap 2), bukan di request
    // HTTP -- jadi p95 latensi ekstraksi TIDAK bisa dibaca dari histogram
    // HTTP di atas. Dihitung on-demand tiap kali /metrics di-scrape, dari
    // durationMs yang sudah tersimpan di Postgres per job (Tahap 5).
    new Gauge({
      name: 'extraction_duration_seconds',
      help: 'Persentil durasi ekstraksi (panggilan model sampai job COMPLETED), dari 100 job COMPLETED terakhir',
      labelNames: ['quantile'],
      registers: [this.registry],
      async collect() {
        const jobs = await prismaService.extractionJob.findMany({
          where: { status: 'COMPLETED', durationMs: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: { durationMs: true },
        });

        const durationsSec = jobs
          .map((j) => (j.durationMs ?? 0) / 1000)
          .sort((a, b) => a - b);

        for (const q of [0.5, 0.95, 0.99]) {
          this.set({ quantile: String(q) }, percentile(durationsSec, q));
        }
      },
    });
  }
}
