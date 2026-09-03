import { describe, expect, it } from 'vitest';
import { compareExtraction, tallyByField } from './scoring';
import type { ReceiptV1 } from '../src/extraction/schema/schema.v1';

describe('compareExtraction', () => {
  it('cocokkan field menu, sub_total, total yang sama persis', () => {
    const groundTruth = {
      menu: { nm: 'Kopi', cnt: '1', price: '15.000' },
      sub_total: { subtotal_price: '15.000' },
      total: { total_price: '15.000' },
    };
    const predicted: ReceiptV1 = {
      menu: [{ nm: 'Kopi', cnt: '1', price: '15.000', unitprice: null }],
      sub_total: { subtotal_price: '15.000', tax_price: null, service_price: null },
      total: { total_price: '15.000', cashprice: null, changeprice: null },
    };

    const results = compareExtraction(groundTruth, predicted);
    expect(results.every((r) => r.match)).toBe(true);
  });

  it('ground truth menu objek tunggal (bukan array) dinormalisasi jadi 1 item', () => {
    const groundTruth = { menu: { nm: 'Kopi', cnt: '1' } };
    const predicted: ReceiptV1 = {
      menu: [{ nm: 'Kopi', cnt: '1', price: null, unitprice: null }],
      sub_total: null,
      total: null,
    };

    const results = compareExtraction(groundTruth, predicted);
    expect(results.find((r) => r.field === 'menu[0].nm')?.match).toBe(true);
  });

  it('ground truth array duplikat -- cocok kalau prediksi sama dengan salah satu elemen', () => {
    const groundTruth = { total: { total_price: ['15.000', '15000'] } };
    const predicted: ReceiptV1 = {
      menu: [],
      sub_total: null,
      total: { total_price: '15000', cashprice: null, changeprice: null },
    };

    const results = compareExtraction(groundTruth, predicted);
    expect(results.find((r) => r.field === 'total.total_price')?.match).toBe(true);
  });

  it('field yang tidak ada ground truth-nya tidak ikut dievaluasi', () => {
    const groundTruth = { total: { total_price: '15.000' } };
    const predicted: ReceiptV1 = {
      menu: [],
      sub_total: null,
      total: { total_price: '15.000', cashprice: '20.000', changeprice: null },
    };

    const results = compareExtraction(groundTruth, predicted);
    expect(results.find((r) => r.field === 'total.cashprice')).toBeUndefined();
  });

  it('prediksi salah -- match false', () => {
    const groundTruth = { total: { total_price: '15.000' } };
    const predicted: ReceiptV1 = {
      menu: [],
      sub_total: null,
      total: { total_price: '99.000', cashprice: null, changeprice: null },
    };

    const results = compareExtraction(groundTruth, predicted);
    expect(results.find((r) => r.field === 'total.total_price')?.match).toBe(false);
  });
});

describe('tallyByField', () => {
  it('gabungkan index array menu[0]/menu[1] jadi satu key menu[]', () => {
    const tally = tallyByField([
      [
        { field: 'menu[0].nm', expected: 'a', actual: 'a', match: true },
        { field: 'menu[1].nm', expected: 'b', actual: 'x', match: false },
      ],
    ]);

    const menuNm = tally.find((t) => t.field === 'menu[].nm');
    expect(menuNm).toEqual({ field: 'menu[].nm', matched: 1, total: 2 });
  });

  it('akumulasi lintas beberapa sampel', () => {
    const tally = tallyByField([
      [{ field: 'total.total_price', expected: '1', actual: '1', match: true }],
      [{ field: 'total.total_price', expected: '2', actual: '9', match: false }],
    ]);

    expect(tally).toEqual([{ field: 'total.total_price', matched: 1, total: 2 }]);
  });
});
