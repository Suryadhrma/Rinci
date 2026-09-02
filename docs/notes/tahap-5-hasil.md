# Tahap 5 — Hasil pengukuran routing model

## Setup
20 sampel `test` CORD sama persis di kedua run (kode & prompt sama,
cuma `GEMINI_MODEL_ESCALATION` beda), dijalankan berurutan di hari yang
sama (2026-09-02) biar kondisi model sedapat mungkin sebanding.

- **Run A (baseline):** `GEMINI_MODEL_ESCALATION` kosong -- selalu
  `gemini-3.5-flash-lite`. `eval/runs/2026-09-02T06-43-36-569Z__e59c83bc.json`
- **Run B (routed):** eskalasi ke `gemini-3.5-flash` kalau
  `confidence.needsReview` true. `eval/runs/2026-09-02T06-50-22-523Z__e59c83bc.json`

Dibandingkan pakai `npm run eval:compare -- <run A> <run B>`.

## Hasil
| | A (murah saja) | B (routed) |
|---|---|---|
| Akurasi keseluruhan | 90.1% (173/192) | 90.1% (173/192) |
| Sampel dieskalasi | 0/20 | 4/20 (20%) |
| Rata-rata biaya/dokumen* | $0.000959 | $0.001728 |

*tarif berbayar resmi Gemini API, BUKAN tagihan riil -- project ini
jalan di free tier (Rp0 sungguhan). Lihat `src/extraction/pricing.ts`.

Per field yang berubah: `menu[].unitprice` naik +12.5pp (37.5% -> 50.0%),
`menu[].price` turun -2.6pp (92.3% -> 89.7%). Field lain persis sama.

## Kesimpulan (jujur, bukan di-spin)
**Routing TIDAK menghasilkan hemat biaya di sample ini -- justru 80.2%
lebih mahal**, karena 4 dari 20 sampel dianggap `needsReview` (biasanya
karena `total.total_price` null atau mismatch aritmetika) dan dipanggil
ulang dengan model yang jauh lebih mahal (`gemini-3.5-flash`: $1.50/$9.00
per 1M token vs `gemini-3.5-flash-lite`: $0.30/$2.50). Akurasi
keseluruhan TIDAK berubah (90.1% -> 90.1%) -- satu field membaik,
satu field justru sedikit memburuk, saling menghilangkan secara neto.

Kemungkinan penyebab: confidence heuristik Tahap 4 menandai kasus yang
sebenarnya bukan salah model (mis. struk yang memang tidak punya total
tercetak), jadi eskalasi ke model lebih mahal tidak membantu -- masalahnya
bukan di kemampuan model, tapi di gambar itu sendiri. n=20 juga kecil,
4 sampel eskalasi terlalu sedikit buat kesimpulan kuat.

**Ini temuan yang tetap dilaporkan apa adanya** (bukan skenario "hemat
40%" yang dikarang) sesuai aturan kejujuran pelaporan di CLAUDE.md.
Kalau nanti mau benerin threshold/strategi eskalasi, mulai dari sini.
