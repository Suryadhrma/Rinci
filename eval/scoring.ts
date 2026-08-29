import type { ReceiptV1 } from '../src/extraction/schema/schema.v1';

export interface FieldComparison {
  field: string;
  expected: string;
  actual: string | null;
  match: boolean;
}

export interface FieldTally {
  field: string;
  matched: number;
  total: number;
}

const MENU_ITEM_FIELDS = ['nm', 'cnt', 'price', 'unitprice'] as const;
const SUB_TOTAL_FIELDS = ['subtotal_price', 'tax_price', 'service_price'] as const;
const TOTAL_FIELDS = ['total_price', 'cashprice', 'changeprice'] as const;

type RawRecord = Record<string, unknown>;

// Sampel asli CORD kadang mengembalikan "menu" sebagai objek tunggal
// (struk isi 1 item), bukan array -- sama seperti quirk yang ditangani
// z.preprocess di schema.v1.ts, tapi di sini untuk ground truth mentah
// yang belum lewat skema kita.
function normalizeMenu(raw: unknown): RawRecord[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw as RawRecord[];
  return [raw as RawRecord];
}

// Ground truth CORD kadang menyimpan satu field sebagai array duplikat
// (mis. karena beberapa area teks pada gambar ditandai kategori yang
// sama). Anggap cocok kalau prediksi sama dengan salah satu elemennya.
function valueMatches(expected: unknown, actual: string | null): boolean {
  const candidates = Array.isArray(expected) ? expected : [expected];
  return candidates.some((c) => String(c).trim() === String(actual ?? '').trim());
}

function pushFieldComparisons(
  results: FieldComparison[],
  prefix: string,
  fields: readonly string[],
  gtGroup: RawRecord,
  predGroup: RawRecord | null | undefined,
): void {
  for (const field of fields) {
    const expected = gtGroup[field];
    // Field yang tidak ada ground truth-nya tidak dievaluasi -- tidak
    // bisa diklaim benar/salah tanpa pembanding (lihat CLAUDE.md: dataset).
    if (expected == null) continue;

    const actual = (predGroup?.[field] as string | null | undefined) ?? null;
    results.push({
      field: `${prefix}.${field}`,
      expected: String(expected),
      actual,
      match: valueMatches(expected, actual),
    });
  }
}

export function compareExtraction(groundTruth: unknown, predicted: ReceiptV1): FieldComparison[] {
  const gt = (groundTruth ?? {}) as RawRecord;
  const results: FieldComparison[] = [];

  const gtMenu = normalizeMenu(gt.menu);
  const predMenu = predicted.menu ?? [];
  gtMenu.forEach((gtItem, i) => {
    pushFieldComparisons(results, `menu[${i}]`, MENU_ITEM_FIELDS, gtItem, predMenu[i] as RawRecord | undefined);
  });

  pushFieldComparisons(
    results,
    'sub_total',
    SUB_TOTAL_FIELDS,
    (gt.sub_total ?? {}) as RawRecord,
    predicted.sub_total,
  );

  pushFieldComparisons(results, 'total', TOTAL_FIELDS, (gt.total ?? {}) as RawRecord, predicted.total);

  return results;
}

export function tallyByField(allComparisons: FieldComparison[][]): FieldTally[] {
  const tally = new Map<string, FieldTally>();

  for (const comparisons of allComparisons) {
    for (const c of comparisons) {
      // Buang index array ("menu[0].nm" -> "menu[].nm") supaya semua
      // item menu dari semua sampel masuk satu baris skor yang sama.
      const key = c.field.replace(/\[\d+\]/, '[]');
      const entry = tally.get(key) ?? { field: key, matched: 0, total: 0 };
      entry.total += 1;
      if (c.match) entry.matched += 1;
      tally.set(key, entry);
    }
  }

  return [...tally.values()].sort((a, b) => a.field.localeCompare(b.field));
}
