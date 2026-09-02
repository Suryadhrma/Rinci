# 004 — Confidence scoring heuristik, bukan dari model (Tahap 4)
## Konteks
Tahap 4 butuh sinyal confidence per field buat nentuin `needsReview`.
Gemini API yang dipakai (`generateContent`) tidak mengembalikan logprob
per token, jadi tidak ada confidence asli dari model buat dipakai.
## Opsi
A) Ganti ke API/model lain yang expose logprob.
B) Confidence heuristik berbasis aturan: null-check + validasi aritmetika
(subtotal+pajak+service vs total, cnt×unitprice vs price).
## Keputusan & alasan
Pilih B. Ganti model cuma buat logprob menambah kompleksitas besar
(provider lain, kalibrasi ulang) buat manfaat tidak pasti. Validasi
aritmetika juga langsung menyasar `menu[].price`, field akurasi
terendah di eval Tahap 0 (`docs/notes/tahap-0-hasil.md`). Skor ini
disebut heuristik secara eksplisit di kode & response API — bukan
"confidence Gemini" — sesuai aturan kejujuran pelaporan di CLAUDE.md.
## Konsekuensi
Field yang benar tapi kebetulan bikin selisih arithmetic (mis. ada biaya
lain yang tidak tertangkap skema) bisa salah ditandai `needsReview`.
Threshold (0.6) belum divalidasi terhadap ground truth — kandidat buat
diukur di eval kalau nanti Tahap 6 (review queue) jalan.
