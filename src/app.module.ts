import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExtractionModule } from './extraction/extraction.module';
import { PrismaModule } from './prisma/prisma.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    JobsModule,
    ExtractionModule,
  ],
})
export class AppModule {}
