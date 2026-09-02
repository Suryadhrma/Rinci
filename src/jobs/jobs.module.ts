import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { DeadLetterController } from './dead-letter.controller';
import { JobsService } from './jobs.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  // DeadLetterController didaftar duluan -- rute statis `jobs/dead-letter`
  // harus dicek sebelum rute parametrik `jobs/:id` di JobsController,
  // kalau tidak "dead-letter" bakal ketangkep sebagai :id.
  controllers: [DeadLetterController, JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
