# 006 — Web app Tahap 6: halaman statis manual, bukan artifact Claude Design
## Konteks
CLAUDE.md bilang Tahap 6 "dibangun pakai Claude Design". Artifact Claude
Design jalan di origin claude.ai dengan CSP ketat -- cuma boleh manggil
Google Fonts, semua host lain (termasuk `localhost:3000` tempat API
Rinci jalan) diblokir. Artifact publik jadi TIDAK BISA fetch API lokal.
## Opsi
A) Tetap pakai Claude Design buat mockup visual, lalu porting manual ke
`public/*.html` yang terhubung API asli (dua langkah).
B) Langsung tulis `public/*.html` (vanilla JS, tanpa build step) yang
terhubung API asli, gaya konsisten sama `index.html` Tahap 0.
## Keputusan & alasan
Pilih B. Langkah desain terpisah (opsi A) nambah waktu buat "kalau
sempat" tier tanpa nilai tambah besar -- style `index.html` sudah cukup
jadi acuan visual. Tetap satu surface web (bukan nambah surface baru),
tetap tanpa build step sesuai keputusan Tahap 0.
## Konsekuensi
Tiga halaman baru: `review.html` (queue), `job.html` (dua kolom + form
koreksi), `dashboard.html` (baca `eval/runs/*.json` via `GET /eval/runs`).
Backend nambah `GET /jobs` (list), `GET /jobs/:id/image` (stream file,
storagePath tidak pernah keluar), `POST /jobs/:id/correction` (validasi
`receiptSchemaV1` yang sama dipakai buat output model). Koreksi manusia
ditulis ke `data/cord/corrections/ground_truth.json` (format sama seperti
`scripts/prepare_dataset.py`) -- bisa langsung dipakai
`npm run eval -- --split corrections`.
