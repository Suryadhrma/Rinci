# 003 — Idempotency key, retry, dead-letter queue (Tahap 3)
## Konteks
Tahap 3: upload duplikat (double-submit, retry klien) tidak boleh
diproses dua kali; kegagalan transient (rate limit, 5xx) harus dicoba
ulang; kegagalan permanen harus bisa diperiksa, bukan hilang begitu saja.
## Opsi
Idempotency: (A) key terpisah dari klien, (B) hash isi file (sha256).
DLQ: (A) tabel Postgres terpisah, (B) manfaatkan set "failed" bawaan BullMQ.
## Keputusan & alasan
Pilih B di keduanya. Hash isi file tidak butuh klien kirim apa pun
tambahan, dan langsung mendeteksi isi yang identik. Set "failed" BullMQ
sudah menyimpan attemptsMade/failedReason/timestamp per job — tidak perlu
duplikasi state di tabel lain, cukup endpoint buat baca (`GET
/jobs/dead-letter`). Retry job-level: 3 attempts, exponential backoff
5s/10s/20s, di atas retry transient yang sudah ada di
`GeminiExtractionProvider` (500ms-1s-2s, buat hiccup cepat).
## Konsekuensi
Race condition kecil: dua upload identik yang benar-benar bersamaan
(sebelum row pertama tersimpan) bisa lolos dedup dan diproses dua kali —
diterima sebagai risiko rendah untuk skala project ini, bukan
diselesaikan dengan locking/transaction penuh. `removeOnFail`/
`removeOnComplete` dibatasi hitungannya biar kuota Redis gratis tidak
membengkak.
