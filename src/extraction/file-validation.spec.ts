import { describe, expect, it } from 'vitest';
import { detectImageMimeType } from './file-validation';

describe('detectImageMimeType', () => {
  it('deteksi JPEG dari magic byte, bukan dari nama file', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectImageMimeType(jpeg)).toBe('image/jpeg');
  });

  it('deteksi PNG dari magic byte', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(detectImageMimeType(png)).toBe('image/png');
  });

  it('deteksi WebP dari header RIFF/WEBP', () => {
    const webp = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('WEBP', 'ascii'),
    ]);
    expect(detectImageMimeType(webp)).toBe('image/webp');
  });

  it('tolak file .exe yang cuma di-rename jadi .jpg -- isi bytenya bukan gambar', () => {
    const fakeExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // "MZ" -- header PE/exe Windows
    expect(detectImageMimeType(fakeExe)).toBeNull();
  });

  it('tolak buffer kosong', () => {
    expect(detectImageMimeType(Buffer.alloc(0))).toBeNull();
  });
});
