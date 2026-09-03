import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExtractionModule } from './extraction/extraction.module';
import { PrismaModule } from './prisma/prisma.module';
import { JobsModule } from './jobs/jobs.module';
import { EvalDashboardModule } from './eval-dashboard/eval-dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    JobsModule,
    ExtractionModule,
    EvalDashboardModule,
  ],
})
export class AppModule {}
