# Tahap 0 — Hasil uji 20 sampel CORD

**Setup:** 20 sampel pertama dari `test` split CORD-v2 (`data/cord/test/0000.jpg`–`0019.jpg`),
model `gemini-3.5-flash`, prompt `v1`, skema `schema.v1.ts`.

## Akurasi per field

Dibandingkan cuma field yang ada di skema v1 (`nm`, `cnt`, `price` untuk item
pertama; `subtotal_price`, `tax_price`; `total_price`). Field yang tidak ada
di ground truth sampel tertentu (`gt_missing`) tidak dihitung — sesuai
aturan "jangan bikin field yang tidak punya ground truth".

| Field | Match | gt_missing | Akurasi |
|---|---|---|---|
| menu[0].nm | 18/20 | 0 | 90,0% |
| menu[0].cnt | 15/16 | 4 | 93,8% |
| menu[0].price | 18/19 | 1 | 94,7% |
| sub_total.subtotal_price | 13/14 | 6 | 92,9% |
| sub_total.tax_price | 8/8 | 12 | 100,0% |
| total.total_price | 18/19 | 1 | 94,7% |
| **Overall** | **90/96** | | **93,8%** |

## Mismatch, satu per satu

1. **`0000.jpg` — `menu.price`: gt `60.000`, model `120.000`.**
   Model kelihatannya menghitung `unitprice × cnt` (60.000 × 2) alih-alih
   membaca angka yang benar-benar tertera di baris item. Ini kesalahan
   model yang nyata, bukan masalah data.
2. **`0009.jpg` — `menu.nm`: gt `"Bumbu Kaldu Ayam 1"`, model `"Bumbu Kaldu Ayam"`.**
   Model membuang angka `1` di ujung nama. Ambigu apakah `1` itu bagian
   nama produk atau bocoran field lain — perlu dicek manual ke gambar
   aslinya kalau mau yakin ini salah model atau ground truth yang aneh.
3. **`0010.jpg` — `menu.cnt`: gt `"1 x"`, model `"1"`.**
   Ground truth CORD kadang menyimpan teks literal dari struk termasuk
   simbol (`x`), model menormalisasi jadi angka polos. Secara makna
   modelnya benar, tapi exact-string match menganggapnya salah.
4. **`0012.jpg` — `menu.nm`: gt `"BLUS WANITA"`, model `"0571-1854 BLUS WANITA"`.**
   Model mengikutkan kode SKU yang di struk memang nempel dengan nama
   barang; anotasi CORD memisahkannya. Sama seperti #3, ini soal
   konvensi anotasi, bukan murni model ngaco.
5. **`0013.jpg` — `sub_total.subtotal_price`: gt `["46.636", "46.636"]`, model `"46.636"`.**
   Ground truth-nya sendiri berupa **array duplikat**, bukan string
   tunggal — kuirk CORD lain yang belum ketahuan sebelumnya. Model
   sebenarnya benar; ini keterbatasan script perbandingan cepat ini
   (`compare.py`, bukan `eval/scoring.ts`), bukan kesalahan model.
6. **`0018.jpg` — `total.total_price`: gt `"156000"`, model `null`.**
   Satu-satunya *miss* asli (model bilang tidak ada, padahal ada). Kalau
   dikeluarkan angka ke-5 (bukan kesalahan model), akurasi riil kurang
   lebih 94,8%.

## Temuan penting buat Tahap 1 (eval harness)

- **Free tier `gemini-3.5-flash` cuma 5 request/menit.** Retry bawaan di
  `GeminiExtractionProvider` (backoff 500ms → 1s → 2s) jauh lebih pendek
  dari waktu tunggu yang diminta API saat kena limit (bisa sampai 59
  detik) — begitu limit kena, 3x percobaan habis dalam <2 detik dan
  langsung gagal (500), bukan berhasil setelah nunggu. `eval/scoring.ts`
  yang jalanin N sampel nanti wajib throttle request (spasi ~13
  detik/request minimal), bukan cuma andalkan retry generik.
- **Exact-string match kurang cukup buat scoring.** Ground truth CORD
  kadang menyimpan simbol literal (`"1 x"`), kadang nempelin SKU ke nama
  barang, dan kadang satu field berupa **array**, bukan string tunggal.
  `eval/scoring.ts` perlu keputusan eksplisit soal normalisasi sebelum
  membandingkan (trim simbol umum? gimana handle field ber-array?) —
  bukan keputusan yang bisa didiamkan sampai nanti.
- **`menu.price` adalah field paling rawan salah** dari yang diamati di
  20 sampel ini — model kadang menghitung alih-alih membaca. Layak jadi
  kandidat pertama buat validasi aritmetika di Tahap 4 (`price` item
  dicek ulang terhadap `subtotal_price`).
