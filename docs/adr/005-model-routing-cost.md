# 005 — Routing model murah-dulu, eskalasi pas confidence rendah (Tahap 5)
## Konteks
Tahap 5 minta: catat biaya per dokumen, coba model murah dulu, eskalasi
ke model lebih mahal cuma kalau perlu, lalu ukur trade-off akurasi vs
hemat di eval.
## Opsi
A) Selalu pakai satu model (status quo Tahap 0-4).
B) `GEMINI_MODEL` (murah, default `gemini-3.5-flash-lite`) dipanggil
dulu; kalau `confidence.needsReview` true, panggil ulang dengan
`GEMINI_MODEL_ESCALATION` (`gemini-3.5-flash`, generasi sama, lebih
mahal/mampu) pakai gambar yang sama.
## Keputusan & alasan
Pilih B. Confidence heuristik dari Tahap 4 (`docs/adr/004-*.md`) dipakai
langsung sebagai sinyal eskalasi -- tidak perlu bikin metrik baru.
Eskalasi ke model generasi sama (bukan lompat generasi) biar hasilnya
lebih mudah diatribusikan ke "model lebih mahal", bukan "model beda
generasi". Harga diambil manual dari halaman resmi Google (dicek
2026-09-02, lihat `src/extraction/pricing.ts`) -- model yang tidak ada
di tabel harga balikin cost `null`, bukan ditebak.
## Konsekuensi
Token/biaya dari percobaan model murah yang dibuang (pas eskalasi)
tetap dihitung -- itu tetap panggilan API beneran. `eval/compare.ts`
(sebelumnya ditunda karena YAGNI di Tahap 1) sekarang dipakai buat
bandingkan run dengan/tanpa eskalasi. Angka biaya di semua tempat pakai
tarif BERBAYAR resmi walau project ini jalan di free tier (Rp0 riil) --
harus selalu dilabeli begitu di README, bukan diklaim tagihan sungguhan.
