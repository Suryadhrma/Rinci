# Deploy ke Railway

Ini panduan buat Surya jalankan sendiri — bikin akun & hubungkan GitHub
harus lewat browser Surya langsung, tidak bisa dilakukan Claude Code.

## 1. Bikin akun & hubungkan repo
1. Buka [railway.app](https://railway.app), daftar (paling gampang pakai
   login GitHub).
2. **New Project** → **Deploy from GitHub repo** → pilih `Suryadhrma/Rinci`.
3. Railway otomatis deteksi `railway.json` di root repo dan bikin
   service pertama (ini yang jadi **service API**).

## 2. Isi environment variable buat service API
Buka service API → tab **Variables** → isi (nilai sama seperti `.env`
lokal, jangan disalin ke file manapun di repo):
```
DATABASE_URL=<connection string Neon>
REDIS_URL=<connection string Upstash, rediss://...>
GEMINI_API_KEY=<API key Gemini>
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_MODEL_ESCALATION=gemini-3.5-flash
UPLOAD_DIR=storage/uploads
FILE_RETENTION_HOURS=24
```
`PORT` otomatis di-set Railway — jangan ditimpa manual.

## 3. Tambah service worker (proses kedua, dari repo yang sama)
Worker harus jadi service TERPISAH (bukan cuma command tambahan di
service API), karena dia proses Node yang berjalan terus-menerus
sendiri (lihat `docs/adr/002-*.md` soal kenapa API dan worker dipisah).

1. Di project yang sama, klik **+ New** → **GitHub Repo** → pilih
   `Suryadhrma/Rinci` lagi.
2. Buka service baru ini → **Settings** → **Deploy** → **Custom Start
   Command** → isi: `npm run worker`
3. Buka tab **Variables** service ini, isi environment variable yang
   SAMA PERSIS seperti service API di langkah 2 (Railway punya fitur
   "Shared Variables" di level Project Settings — pakai itu supaya
   tidak perlu isi dua kali dan supaya kalau ganti API key nanti cukup
   sekali update).

## 4. Cek log
Kedua service harus nunjukkin log yang mirip pas jalan lokal:
- Service API: `Nest application successfully started`, `Rinci jalan di http://...`
- Service worker: `Worker jalan, menunggu job dari queue "extraction"...`

Kalau service API gagal start, cek dulu apa migration Prisma
(`npx prisma migrate deploy`, bagian dari start command di
`railway.json`) berhasil connect ke Neon — biasanya kelihatan di log.

## 5. Ambil URL publik
Service API dapat URL otomatis bentuk `https://<nama>.up.railway.app`
(cek tab **Settings** → **Networking** → **Generate Domain** kalau
belum otomatis muncul). Itu link demo publiknya — kabari Claude Code
URL-nya biar bisa ditambahkan ke README.

## Batasan yang perlu disadari
- **Storage ephemeral**: file upload hilang tiap redeploy/restart
  container (bukan cuma soal retensi 24 jam yang memang disengaja).
  Diterima sebagai batasan demo, bukan dibenahi dengan Railway Volume
  (biaya tambahan, belum perlu di skala ini).
- **Kuota Gemini free tier ketat** (lihat `docs/notes/tahap-0-hasil.md`)
  — demo publik yang kena traffic ramai bisa cepat habiskan kuota
  harian. Rate limit `POST /extract` (5/menit/IP) sudah membantu, tapi
  bukan jaminan penuh.
- Railway trial pakai kredit gratis terbatas, setelah itu bayar sesuai
  pemakaian — pantau usage di dashboard Railway.
