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
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
