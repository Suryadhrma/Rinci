import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExtractionModule } from './extraction/extraction.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ExtractionModule,
  ],
})
export class AppModule {}
