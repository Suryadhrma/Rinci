/**
 * Deteksi tipe file dari isi byte-nya sendiri ("magic number" — beberapa byte
 * pertama yang jadi penanda format file), bukan dari `mimetype`/ekstensi yang
 * diklaim si pengirim. Klaim itu gampang dipalsukan (upload .exe diganti nama
 * jadi foto.jpg); isi byte tidak.
 */
export type AllowedImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

const SIGNATURES: Array<{ mimeType: AllowedImageMimeType; matches: (buf: Buffer) => boolean }> = [
  {
    mimeType: 'image/jpeg',
    matches: (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
  {
    mimeType: 'image/png',
    matches: (buf) =>
      buf.length >= 8 &&
      buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mimeType: 'image/webp',
    matches: (buf) =>
      buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

export function detectImageMimeType(buffer: Buffer): AllowedImageMimeType | null {
  return SIGNATURES.find((sig) => sig.matches(buffer))?.mimeType ?? null;
}
