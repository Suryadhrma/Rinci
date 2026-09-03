# 008 — Retensi file demo publik: hapus file, simpan row
## Konteks
CLAUDE.md wajibkan "hapus file pengunjung setelah beberapa jam" buat
demo publik. Belum ada mekanisme ini sebelum Tahap 7.
## Opsi
A) Hapus seluruh row `ExtractionJob` (file + hasil + metrik) setelah N jam.
B) Hapus cuma file gambarnya (`storagePath`), row Postgres (hasil,
confidence, biaya) tetap ada.
## Keputusan & alasan
Pilih B. Foto struk pengunjung itu yang privasinya sensitif -- hasil
ekstraksi teks + metrik biaya/akurasi tidak, dan tetap berguna buat
histori dashboard eval (Tahap 6) & metrik `/metrics` (Tahap 7).
`GET /jobs/:id/image` sudah nangani file hilang (404 "sudah tidak ada
di disk") tanpa perubahan apa pun -- cukup jalankan `unlink()`.
`@nestjs/schedule` (`@Cron(EVERY_HOUR)`) di proses **worker saja**,
bukan API -- kalau didaftar di keduanya, dua proses jalanin cron yang
sama tiap jam. Retensi default 24 jam, diatur `FILE_RETENTION_HOURS`.
## Konsekuensi
Row lama menumpuk tanpa batas di Postgres (Neon free tier) -- kalau
suatu saat jadi masalah nyata, baru dibikinkan retensi row juga.
