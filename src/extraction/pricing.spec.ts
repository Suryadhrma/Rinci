import { describe, expect, it } from 'vitest';
import { calculateCostUsd } from './pricing';

describe('calculateCostUsd', () => {
  it('hitung biaya buat model yang ada di tabel harga', () => {
    // gemini-3.5-flash-lite: $0.30/1M input, $2.50/1M output
    const cost = calculateCostUsd('gemini-3.5-flash-lite', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.3 + 2.5, 6);
  });

  it('model di luar tabel balikin null, bukan ditebak', () => {
    expect(calculateCostUsd('model-yang-tidak-ada', 1000, 1000)).toBeNull();
  });

  it('0 token -> biaya 0', () => {
    expect(calculateCostUsd('gemini-3.5-flash-lite', 0, 0)).toBe(0);
  });
});
