import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global: PrismaService dipakai hampir semua module (jobs, extraction, worker)
// -- daripada import PrismaModule berulang di tiap module, cukup daftar sekali
// di root module (AppModule / WorkerModule).
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
