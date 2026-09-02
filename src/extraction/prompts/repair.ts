import type { ZodIssue } from 'zod';

// Dipakai saat output pertama gagal validasi skema (schema.v1.ts) --
// dikirim ulang ke model bareng gambar yang sama, minta diperbaiki
// daripada langsung gagal. Cuma dipakai sekali per ekstraksi (lihat
// extraction.service.ts) biar biaya/latensi terkendali.
export function buildRepairPromptV1(invalidOutput: unknown, issues: ZodIssue[]): string {
  const issueList = issues.map((issue) => `- ${issue.path.join('.') || '(root)'}: ${issue.message}`).join('\n');

  return `Output JSON kamu sebelumnya TIDAK sesuai skema yang diminta. Ini output-nya:

${JSON.stringify(invalidOutput)}

Masalah yang ditemukan:
${issueList}

Perbaiki JSON di atas berdasarkan gambar struk yang sama, supaya sesuai skema:

{
  "menu": [
    { "nm": string | null, "cnt": string | null, "price": string | null, "unitprice": string | null }
  ],
  "sub_total": { "subtotal_price": string | null, "tax_price": string | null, "service_price": string | null } | null,
  "total": { "total_price": string | null, "cashprice": string | null, "changeprice": string | null } | null
}

Balikan HANYA JSON yang sudah diperbaiki (field yang sama persis, tipe yang benar, tanpa field tambahan, tanpa markdown, tanpa penjelasan lain).`;
}
