# Deploy ke Render

Bikin akun & hubungkan GitHub harus lewat browser Surya langsung, tidak
bisa dilakukan Claude Code. Panduan ini asumsikan itu sudah selesai
(project Render sudah dibuat, terhubung ke `Suryadhrma/Rinci`).

Kenapa Render (bukan lagi Railway, lihat `docs/adr/010-render-bukan-railway.md`):
Render punya tipe service **Background Worker** — proses yang jalan
terus tanpa perlu port HTTP, pas banget buat `src/worker.ts` yang
memang begitu (lihat `docs/adr/002-*.md`). Tapi Background Worker
biasanya butuh paid plan (kartu kredit) — kalau tidak punya kartu
kredit, pakai **opsi A** di bawah.

## Kenapa build command-nya begitu
Fresh install (`npm install`/`npm ci`) TIDAK otomatis jalanin
`prisma generate` — `package.json` tidak punya `postinstall` buat itu.
Kalau lupa, `nest build` bakal gagal karena kode kita import tipe dari
`@prisma/client` yang belum digenerate. Makanya build command SELALU
diawali `npx prisma generate`.

Migration (`prisma migrate deploy`) sengaja ditaruh di **start command**
(bukan build command) -- build tidak perlu koneksi DB sama sekali,
migration baru jalan pas container beneran mau start.

## Opsi A — Tanpa kartu kredit: satu Web Service saja (direkomendasikan)
Render Web Service tier gratis tidak butuh kartu kredit sama sekali.
Worker (consumer queue + cron cleanup) digabung jalan di proses API
yang sama lewat env var `RUN_WORKER_IN_PROCESS=true` — lihat
`docs/adr/011-worker-in-process.md` buat alasan & trade-off-nya.

**Satu service, tipe Web Service:**
- **Environment**: Node
- **Build Command**: `npx prisma generate && npm run build`
- **Start Command**: `npx prisma migrate deploy && npm run start`
- **Instance Type**: Free
- **Environment variable tambahan**: `RUN_WORKER_IN_PROCESS=true`

Itu saja — tidak perlu bikin service kedua. Lanjut ke bagian
"Environment variables" dan "Cek log" di bawah.

## Opsi B — Punya kartu kredit / mau proses terpisah beneran
Dua service, API dan worker dipisah persis kayak lokal (`npm run dev` +
`npm run worker`) -- lebih dekat ke desain asli Tahap 2, tapi biasanya
butuh paid plan buat Background Worker-nya.

**Service 1 — Web Service (API)**, sama seperti Opsi A tapi **TANPA**
`RUN_WORKER_IN_PROCESS`.

**Service 2 — Background Worker:**
- **Type**: Background Worker (BUKAN Web Service -- tidak ada port/health check)
- **Build Command**: `npx prisma generate && npm run build`
- **Start Command**: `npm run worker`

Kalau pilih opsi ini, isi environment variable yang sama di KEDUA
service (kecuali `RUN_WORKER_IN_PROCESS`, tidak perlu di opsi ini).

## Environment variables
```
DATABASE_URL             <- connection string Neon
REDIS_URL                <- connection string Upstash (rediss://...)
GEMINI_API_KEY            <- API key Gemini
GEMINI_MODEL              gemini-3.5-flash-lite
GEMINI_MODEL_ESCALATION   gemini-3.5-flash
UPLOAD_DIR                storage/uploads
FILE_RETENTION_HOURS      24
NODE_VERSION              22
RUN_WORKER_IN_PROCESS     true   <- CUMA buat Opsi A
```
Jangan set `PORT` manual -- Render isi otomatis buat Web Service.

## Cek log setelah deploy
- **Opsi A** (satu service): cari baris `Nest application successfully
  started`, `Rinci jalan di http://...`, dan
  `RUN_WORKER_IN_PROCESS=true -- worker ... jalan di proses ini juga.`
  di log yang sama.
- **Opsi B** (dua service): Web Service nunjukkin baris di atas TANPA
  baris terakhir; Background Worker nunjukkin
  `Worker jalan, menunggu job dari queue "extraction"...`.

Kalau gagal start, cek dulu apa `prisma migrate deploy` berhasil
connect ke Neon -- biasanya kelihatan jelas di log.

## Ambil URL publik
Render kasih URL otomatis bentuk `https://<nama>.onrender.com` buat Web
Service (lihat di halaman service-nya). Itu link demo publiknya --
kabari Claude Code URL-nya biar bisa ditambahkan ke README.

## Batasan yang perlu disadari
- **Storage ephemeral**: file upload hilang tiap redeploy/restart
  container (bukan cuma soal retensi 24 jam yang memang disengaja,
  lihat `docs/adr/008-*.md`). Diterima sebagai batasan demo.
- **Kuota Gemini free tier ketat** (lihat `docs/notes/tahap-0-hasil.md`)
  -- demo publik yang kena traffic ramai bisa cepat habiskan kuota
  harian. Rate limit `POST /extract` (5/menit/IP) sudah membantu, tapi
  bukan jaminan penuh.
- Free tier web service sleep kalau idle -- demo publik yang jarang
  dipakai bakal kerasa lambat di kunjungan pertama. **Opsi A**: pas
  service bangun dari sleep, worker-nya juga baru mulai jalan lagi
  (satu proses) -- job yang nunggu di antrean baru diproses setelah itu.
