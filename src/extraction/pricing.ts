// Harga resmi Gemini API, tarif berbayar (USD per 1 juta token), dicek
// manual dari https://ai.google.dev/gemini-api/docs/pricing pada
// 2026-09-02. Model yang belum ada di sini balikin cost null (tidak
// ditebak) -- daripada salah lapor angka di README.
//
// PENTING buat pembacaan angka biaya: project ini jalan di FREE TIER
// (lihat CLAUDE.md), jadi biaya riil yang kebayar Rp0. Angka costUsd di
// sini dihitung SEOLAH-OLAH tarif berbayar, buat estimasi kalau nanti
// naik ke paid tier -- bukan tagihan sungguhan.
interface ModelPricing {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

const PRICING: Record<string, ModelPricing> = {
  'gemini-3.5-flash': { inputPerMillionUsd: 1.5, outputPerMillionUsd: 9.0 },
  'gemini-3.5-flash-lite': { inputPerMillionUsd: 0.3, outputPerMillionUsd: 2.5 },
  'gemini-2.5-flash': { inputPerMillionUsd: 0.3, outputPerMillionUsd: 2.5 },
  'gemini-2.5-flash-lite': { inputPerMillionUsd: 0.1, outputPerMillionUsd: 0.4 },
};

export function calculateCostUsd(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const pricing = PRICING[modelName];
  if (!pricing) return null;

  const cost =
    (inputTokens / 1_000_000) * pricing.inputPerMillionUsd +
    (outputTokens / 1_000_000) * pricing.outputPerMillionUsd;

  return Number(cost.toFixed(6));
}
