import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Halaman demo statis (Tahap 0) di-serve langsung dari folder public/
  app.useStaticAssets('public');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Rinci API')
    .setDescription('Ekstraksi dokumen bisnis (struk/nota) jadi data terstruktur tervalidasi.')
    .setVersion('1.0')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, swaggerDocument);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Rinci jalan di http://localhost:${port}`);
  console.log(`API docs: http://localhost:${port}/api-docs`);
}

bootstrap();
