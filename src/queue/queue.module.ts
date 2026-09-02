import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // maxRetriesPerRequest: null -- syarat BullMQ untuk koneksi blocking
        // yang dipakai Worker (bukan cuma default ioredis biasa).
        connection: new IORedis(config.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: null,
        }),
      }),
    }),
    BullModule.registerQueue({
      name: 'extraction',
      defaultJobOptions: {
        // Retry level job (di atas retry transient di GeminiExtractionProvider
        // sendiri) -- exponential backoff: nyoba lagi kalau seluruh proses
        // (baca file, panggil model, validasi skema) gagal, jeda makin lama
        // tiap percobaan (5s, 10s, 20s) biar tidak langsung nge-hammer ulang
        // saat provider/API lagi bermasalah.
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        // Job yang gagal total (habis semua attempts) SENGAJA tidak
        // otomatis dibuang -- itu jadi dead-letter queue-nya, bisa
        // diperiksa lewat GET /jobs/dead-letter. Dibatasi 200 biar Redis
        // (tier gratis) tidak membengkak tanpa batas.
        removeOnFail: { count: 200 },
        removeOnComplete: { count: 100 },
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
