import type { ReceiptV1 } from '../schema/schema.v1';

// Skor di sini heuristik berbasis aturan (null-check + validasi
// aritmetika), BUKAN confidence asli dari model (Gemini tidak
// mengembalikan logprob per token lewat API yang dipakai). Sengaja
// ditulis jelas biar tidak diklaim sebagai sesuatu yang bukan itu --
// lihat aturan "kejujuran pelaporan" di CLAUDE.md.
const BASE_SCORE = 0.95;
const NULL_SCORE_IMPORTANT = 0.3; // field yang harusnya hampir selalu ada di struk asli
const NULL_SCORE_OPTIONAL = 0.9; // null di sini seringnya memang jawaban yang benar
const ARITHMETIC_MISMATCH_SCORE = 0.4;
const CONFIDENCE_THRESHOLD = 0.6;
const ROUNDING_TOLERANCE = 1; // toleransi pembulatan rupiah

export interface ArithmeticCheck {
  expectedTotal: number | null;
  actualTotal: number | null;
  // null kalau data tidak cukup buat dicek (subtotal atau total kosong)
  matches: boolean | null;
}

export interface ConfidenceResult {
  fieldScores: Record<string, number>;
  arithmeticCheck: ArithmeticCheck;
  overallScore: number;
  needsReview: boolean;
}

// Struk yang dites tidak selalu konsisten format angkanya -- kebanyakan
// Indonesia ("." ribuan, "," desimal, lihat CLAUDE.md bagian skema
// ekstraksi), tapi ada juga yang gaya Inggris ("," ribuan, "." desimal)
// atau ada simbol mata uang menyatu (mis. "Rp.111,000" -- prompts/v1.ts
// sengaja suruh model pertahankan simbolnya apa adanya, bukan dibersihkan
// di sana). Ditemukan lewat testing manual: parser versi lama yang cuma
// asumsi format Indonesia salah baca "100,909" jadi 100.909 (harusnya
// 100909), bikin validasi aritmetika "cocok" padahal nilainya salah 1000x.
//
// Heuristik di sini: buang simbol non-angka dulu, lalu anggap titik/koma
// TERAKHIR sebagai desimal HANYA kalau diikuti 1-2 digit -- nominal
// rupiah di struk praktiknya bulat, jadi kelompok 3 digit setelah
// pemisah (apapun karakternya) hampir pasti pemisah ribuan, bukan desimal.
export function parseIndonesianNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;

  const cleaned = raw.replace(/[^0-9.,-]/g, '');
  if (cleaned === '') return null;

  const negative = cleaned.startsWith('-');
  const unsigned = negative ? cleaned.slice(1) : cleaned;
  if (unsigned === '') return null;

  const decimalMatch = unsigned.match(/[.,](\d{1,2})$/);
  const integerPart = decimalMatch ? unsigned.slice(0, -decimalMatch[0].length) : unsigned;
  const decimalPart = decimalMatch ? decimalMatch[1] : '';

  const digits = integerPart.replace(/[.,]/g, '');
  if (!/^\d+$/.test(digits)) return null;

  const num = Number(`${negative ? '-' : ''}${digits}${decimalPart ? '.' + decimalPart : ''}`);
  return Number.isFinite(num) ? num : null;
}

function checkTotalArithmetic(receipt: ReceiptV1): ArithmeticCheck {
  const subtotal = parseIndonesianNumber(receipt.sub_total?.subtotal_price);
  const tax = parseIndonesianNumber(receipt.sub_total?.tax_price) ?? 0;
  const service = parseIndonesianNumber(receipt.sub_total?.service_price) ?? 0;
  const total = parseIndonesianNumber(receipt.total?.total_price);

  if (subtotal == null || total == null) {
    return { expectedTotal: null, actualTotal: total, matches: null };
  }

  const expectedTotal = subtotal + tax + service;
  return {
    expectedTotal,
    actualTotal: total,
    matches: Math.abs(expectedTotal - total) <= ROUNDING_TOLERANCE,
  };
}

// price harusnya cnt * unitprice -- ditemukan di eval Tahap 0 sebagai
// field dengan akurasi terendah, jadi konsistensinya divalidasi di sini.
function menuItemArithmeticMatches(item: ReceiptV1['menu'][number]): boolean | null {
  const cnt = parseIndonesianNumber(item.cnt);
  const unitprice = parseIndonesianNumber(item.unitprice);
  const price = parseIndonesianNumber(item.price);

  if (cnt == null || unitprice == null || price == null) return null;

  return Math.abs(cnt * unitprice - price) <= ROUNDING_TOLERANCE;
}

export function scoreConfidence(receipt: ReceiptV1): ConfidenceResult {
  const fieldScores: Record<string, number> = {};

  fieldScores['total.total_price'] =
    receipt.total?.total_price == null ? NULL_SCORE_IMPORTANT : BASE_SCORE;
  fieldScores['total.cashprice'] = receipt.total?.cashprice == null ? NULL_SCORE_OPTIONAL : BASE_SCORE;
  fieldScores['total.changeprice'] =
    receipt.total?.changeprice == null ? NULL_SCORE_OPTIONAL : BASE_SCORE;

  fieldScores['sub_total.subtotal_price'] =
    receipt.sub_total?.subtotal_price == null ? NULL_SCORE_OPTIONAL : BASE_SCORE;
  fieldScores['sub_total.tax_price'] =
    receipt.sub_total?.tax_price == null ? NULL_SCORE_OPTIONAL : BASE_SCORE;
  fieldScores['sub_total.service_price'] =
    receipt.sub_total?.service_price == null ? NULL_SCORE_OPTIONAL : BASE_SCORE;

  const arithmeticCheck = checkTotalArithmetic(receipt);
  if (arithmeticCheck.matches === false) {
    fieldScores['total.total_price'] = Math.min(fieldScores['total.total_price'], ARITHMETIC_MISMATCH_SCORE);
    fieldScores['sub_total.subtotal_price'] = Math.min(
      fieldScores['sub_total.subtotal_price'],
      ARITHMETIC_MISMATCH_SCORE,
    );
    fieldScores['sub_total.tax_price'] = Math.min(
      fieldScores['sub_total.tax_price'],
      ARITHMETIC_MISMATCH_SCORE,
    );
  }

  receipt.menu.forEach((item, i) => {
    fieldScores[`menu[${i}].nm`] = item.nm == null ? NULL_SCORE_OPTIONAL : BASE_SCORE;
    fieldScores[`menu[${i}].cnt`] = item.cnt == null ? NULL_SCORE_OPTIONAL : BASE_SCORE;
    fieldScores[`menu[${i}].price`] = item.price == null ? NULL_SCORE_OPTIONAL : BASE_SCORE;
    fieldScores[`menu[${i}].unitprice`] = item.unitprice == null ? NULL_SCORE_OPTIONAL : BASE_SCORE;

    if (menuItemArithmeticMatches(item) === false) {
      fieldScores[`menu[${i}].cnt`] = Math.min(fieldScores[`menu[${i}].cnt`], ARITHMETIC_MISMATCH_SCORE);
      fieldScores[`menu[${i}].price`] = Math.min(fieldScores[`menu[${i}].price`], ARITHMETIC_MISMATCH_SCORE);
      fieldScores[`menu[${i}].unitprice`] = Math.min(
        fieldScores[`menu[${i}].unitprice`],
        ARITHMETIC_MISMATCH_SCORE,
      );
    }
  });

  const scores = Object.values(fieldScores);
  const overallScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 1;
  const minScore = scores.length ? Math.min(...scores) : 1;

  return {
    fieldScores,
    arithmeticCheck,
    overallScore: Number(overallScore.toFixed(3)),
    needsReview: minScore < CONFIDENCE_THRESHOLD,
  };
}
