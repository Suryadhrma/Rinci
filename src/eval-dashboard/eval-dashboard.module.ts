import { Module } from '@nestjs/common';
import { EvalDashboardController } from './eval-dashboard.controller';

@Module({
  controllers: [EvalDashboardController],
})
export class EvalDashboardModule {}
