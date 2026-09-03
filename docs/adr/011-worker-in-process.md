# 011 — Opsi worker gabung ke proses API (RUN_WORKER_IN_PROCESS)
## Konteks
Surya tidak punya kartu kredit. Render Web Service tier gratis tidak
butuh kartu kredit, tapi Background Worker (proses terpisah buat
`src/worker.ts`) biasanya butuh paid plan. Tanpa ini, deploy demo
publik buntu total.
## Opsi
A) Paksa cari platform lain yang gratiskan proses kedua tanpa kartu
kredit (belum tentu ada, dan tidak pasti aman/reliable).
B) Worker (consumer BullMQ + cron cleanup) bisa OPSIONAL jalan digabung
ke proses API yang sama, dikontrol env var `RUN_WORKER_IN_PROCESS`.
## Keputusan & alasan
Pilih B. `AppModule` (`src/app.module.ts`) daftarin `ExtractionProcessor`
+ `CleanupService` + `ScheduleModule` cuma kalau
`RUN_WORKER_IN_PROCESS=true` -- default (env var kosong) TIDAK berubah
sama sekali dari desain Tahap 2 (proses API dan worker tetap terpisah,
`src/worker.ts` tidak disentuh). Diuji langsung: 1 proses jalan HTTP +
proses queue bareng, job selesai normal, log kedua peran (`ExtractionService`
+ `ExtractionProcessor`) muncul di proses yang sama.
## Konsekuensi
Kalau nanti Surya dapat kartu kredit / pindah platform yang support
proses kedua gratis, tinggal HAPUS env var itu -- kode dan arsitektur
aslinya (2 proses terpisah) tetap ada, tidak diganti permanen. Trade-off
saat dipakai: web service tier gratis Render sleep kalau idle -- pas
bangun lagi, worker yang nempel di proses yang sama ikut baru mulai
lagi, job yang nunggu di antrean telat diproses sampai ada request yang
"membangunkan" service-nya.
