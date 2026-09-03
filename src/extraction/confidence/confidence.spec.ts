import { describe, expect, it } from 'vitest';
import { parseIndonesianNumber, scoreConfidence } from './confidence';
import type { ReceiptV1 } from '../schema/schema.v1';

describe('parseIndonesianNumber', () => {
  it('parses "." as pemisah ribuan', () => {
    expect(parseIndonesianNumber('10.000')).toBe(10000);
  });

  it('parses "," sebagai desimal', () => {
    expect(parseIndonesianNumber('10.000,50')).toBe(10000.5);
  });

  it('balikin null buat null/undefined/string kosong', () => {
    expect(parseIndonesianNumber(null)).toBeNull();
    expect(parseIndonesianNumber(undefined)).toBeNull();
    expect(parseIndonesianNumber('  ')).toBeNull();
  });

  it('balikin null buat string yang bukan angka', () => {
    expect(parseIndonesianNumber('abc')).toBeNull();
  });
});

function receipt(overrides: Partial<ReceiptV1> = {}): ReceiptV1 {
  return {
    menu: [],
    sub_total: null,
    total: null,
    ...overrides,
  };
}

describe('scoreConfidence', () => {
  it('total_price null -> skor rendah & needsReview true', () => {
    const result = scoreConfidence(
      receipt({
        menu: [{ nm: 'Item', cnt: '1', price: '10.000', unitprice: '10.000' }],
        total: { total_price: null, cashprice: null, changeprice: null },
      }),
    );

    expect(result.fieldScores['total.total_price']).toBeLessThan(0.6);
    expect(result.needsReview).toBe(true);
  });

  it('subtotal+pajak cocok dengan total -> arithmeticCheck matches', () => {
    const result = scoreConfidence(
      receipt({
        sub_total: { subtotal_price: '10.000', tax_price: '1.000', service_price: null },
        total: { total_price: '11.000', cashprice: null, changeprice: null },
      }),
    );

    expect(result.arithmeticCheck.matches).toBe(true);
  });

  it('subtotal+pajak TIDAK cocok dengan total -> flagged, needsReview true', () => {
    const result = scoreConfidence(
      receipt({
        sub_total: { subtotal_price: '10.000', tax_price: '1.000', service_price: null },
        total: { total_price: '50.000', cashprice: null, changeprice: null },
      }),
    );

    expect(result.arithmeticCheck.matches).toBe(false);
    expect(result.needsReview).toBe(true);
  });

  it('cnt x unitprice cocok dengan price di tiap item menu -> confidence tinggi', () => {
    const result = scoreConfidence(
      receipt({
        menu: [{ nm: 'Item', cnt: '2', price: '20.000', unitprice: '10.000' }],
      }),
    );

    expect(result.fieldScores['menu[0].price']).toBeGreaterThanOrEqual(0.9);
  });

  it('cnt x unitprice TIDAK cocok -> field menu itu ditandai rendah', () => {
    const result = scoreConfidence(
      receipt({
        menu: [{ nm: 'Item', cnt: '2', price: '99.000', unitprice: '10.000' }],
      }),
    );

    expect(result.fieldScores['menu[0].price']).toBeLessThan(0.6);
  });

  it('receipt kosong tidak crash -- total_price null (important field) tetap needsReview true', () => {
    const result = scoreConfidence(receipt());
    expect(result.needsReview).toBe(true);
    expect(result.arithmeticCheck.matches).toBeNull();
  });
});
