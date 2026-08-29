import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

@Injectable()
export class LocalStorageService {
  private readonly uploadDir: string;

  constructor(config: ConfigService) {
    this.uploadDir = config.get<string>('UPLOAD_DIR', 'storage/uploads');
  }

  async save(file: Express.Multer.File): Promise<{ path: string; filename: string }> {
    await mkdir(this.uploadDir, { recursive: true });

    const filename = `${randomUUID()}${extname(file.originalname)}`;
    const path = join(this.uploadDir, filename);
    await writeFile(path, file.buffer);

    return { path, filename };
  }
}
