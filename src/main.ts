import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Halaman demo statis (Tahap 0) di-serve langsung dari folder public/
  app.useStaticAssets('public');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Rinci jalan di http://localhost:${port}`);
}

bootstrap();
