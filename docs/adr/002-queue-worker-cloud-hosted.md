# 002 — BullMQ + Redis/Postgres cloud-hosted, bukan Docker lokal
## Konteks
Tahap 2 butuh Postgres + Redis. Tech stack sudah memutuskan Docker
Compose buat itu, tapi device Surya tidak kuat jalanin Docker Desktop.
## Opsi
A) Tetap Docker Compose lokal.
B) BullMQ + Redis dan Prisma + Postgres tetap dipakai, tapi instance-nya
hosted gratis (Upstash buat Redis, Neon buat Postgres) — tersambung
lewat internet, bukan localhost.
## Keputusan & alasan
Pilih B. Kode BullMQ/Prisma-nya sama persis, cuma `REDIS_URL`/
`DATABASE_URL` yang beda — jadi gampang pindah ke Docker lokal nanti
kalau device sudah kuat. MinIO ditunda, tetap simpan file di disk lokal.
## Konsekuensi
Dev butuh koneksi internet (sudah dikonfirmasi bukan masalah). Ada
micro-latency ke server cloud dibanding localhost, tidak signifikan
buat skala project ini.
