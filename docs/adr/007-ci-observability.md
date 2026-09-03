# 007 — CI pakai service container, bukan Neon/Upstash asli
## Konteks
Tahap 7 minta `npm run eval` jalan di GitHub Actions tiap PR. Tapi
`eval/run.ts` bootstrap `AppModule` penuh (Prisma + Queue), jadi butuh
Postgres/Redis nyala buat jalan sama sekali, walau logika eval sendiri
cuma pakai `ExtractionService`.
## Opsi
A) CI pakai `DATABASE_URL`/`REDIS_URL` Neon/Upstash asli (sama kayak dev).
B) CI pakai Postgres+Redis sebagai GitHub Actions service container
(ephemeral, jalan cuma selama run itu).
## Keputusan & alasan
Pilih B. GitHub-hosted runner punya Docker built-in (beda dari device
lokal Surya yang tidak kuat) -- ini justru tempat yang pas buat pakai
Docker. Menghindari run CI numpuk data test ke Neon/Upstash yang sama
dipakai dev asli, dan tidak perlu secret DB/Redis tambahan -- cukup
`GEMINI_API_KEY`. Eval CI dibatasi `--n 5` biar hemat kuota harian free
tier Gemini yang juga dipakai testing manual.
## Konsekuensi
`/metrics` (Tahap 7) baca p95 latensi ekstraksi langsung dari kolom
`durationMs` di Postgres (bukan histogram lintas-proses ke worker) --
worker jalan di proses terpisah tanpa HTTP server, jadi tidak bisa
di-scrape langsung. Rate limit `POST /extract` (5/menit/IP, lebih ketat
dari default global 60/menit) ditutup di tahap ini juga -- seharusnya
sudah ada sejak awal per standar keamanan CLAUDE.md, baru kepasang sekarang.
