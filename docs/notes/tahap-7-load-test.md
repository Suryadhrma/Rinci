# Tahap 7 — Hasil load test (k6)

## Setup
`k6/extract-load-test.js`, 1 VU, 3 iterasi, jeda 13 detik antar iterasi
(di bawah rate limit Gemini free tier). Server API + worker jalan lokal
(`npm run dev` + `npm run worker`). Mengukur **latensi ujung-ke-ujung**:
dari `POST /extract` sampai `GET /jobs/:id` balikin `COMPLETED` — bukan
cuma latensi `POST /extract` itu sendiri, yang sejak Tahap 2 selalu cepat
karena cuma `202 Accepted` + `jobId` (kerja beneran ada di worker,
async).

## Kesalahan metodologi yang ditemukan & diperbaiki
Percobaan pertama pakai file sampel yang SAMA di tiap iterasi --
hasilnya kelihatan mustahil cepat (med=14ms). Ternyata itu bukan bug
performa, itu **idempotency dari Tahap 3 bekerja dengan benar**: upload
isi file yang identik diarahkan ke job yang sudah selesai, bukan
diproses ulang. Percobaan kedua (ganti 1 dari 3 file) masih separuh
terkontaminasi karena 2 file lain sudah pernah diupload di percobaan
sebelumnya. Baru di percobaan ketiga, pakai 3 gambar yang belum pernah
lewat `POST /extract` sama sekali di sesi ini, hasilnya bersih.

**Pelajaran:** load test buat endpoint yang idempotent HARUS pakai data
yang benar-benar baru tiap request, atau angkanya mengukur cache-hit,
bukan kerja asli.

## Hasil (bersih, 3 sampel baru)
| Metrik | Nilai |
|---|---|
| Latensi ekstraksi ujung-ke-ujung -- p50 | 3.05s |
| Latensi ekstraksi ujung-ke-ujung -- p90 | 11.16s |
| **Latensi ekstraksi ujung-ke-ujung -- p95** | **12.18s** |
| Latensi HTTP `POST /extract`/`GET /jobs/:id` -- p95 | 44ms |
| Checks lolos | 6/6 (100%) |

Latensi HTTP murni (44ms p95) jauh lebih kecil dari latensi ekstraksi
(12.18s p95) -- ini yang diharapkan dari desain async Tahap 2: klien
tidak nunggu server, server juga tidak nunggu Gemini di dalam siklus
request/response.

## Keterbatasan jujur
Ini BUKAN stress test sungguhan. Gemini free tier cuma ~5 request/menit
dan kuota harian terbatas (lihat `docs/notes/tahap-0-hasil.md`) -- 1 VU,
3 iterasi cukup buat nunjukkin CARA load test yang benar dan dapat angka
p95 nyata, tapi tidak menunjukkan perilaku di beban tinggi/konkuren.
Kalau nanti pindah ke paid tier, `k6/extract-load-test.js` bisa langsung
dinaikkan `vus`/`iterations`-nya.
