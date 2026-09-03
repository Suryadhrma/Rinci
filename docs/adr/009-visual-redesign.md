# 009 — Redesign visual: landing flashy, tool pages tetap bersih
## Konteks
Diminta "optimalin tampilan, pakai aset 3D kayak Anime.js". Situs kayak
Anime.js itu marketing/showcase (WebGL/3D berat buat kesan visual);
Rinci's tool pages (`review.html`/`job.html`/`dashboard.html`) itu
tempat kerja beneran (isi form, baca angka) -- animasi berat di situ
lebih mungkin ganggu daripada nambah nilai.
## Opsi
A) Semua halaman full 3D/animasi berat.
B) `index.html` (landing) dapet hero 3D (CSS 3D transform + anime.js buat
tilt interaktif), tool pages cuma dimodernisasi (shared `styles.css`,
tanpa animasi berat).
## Keputusan & alasan
Surya pilih B lewat AskUserQuestion. `public/styles.css` jadi design
system bareng (warna, tipografi, komponen card/button/table) dipakai
semua halaman -- konsisten, tanpa duplikasi CSS 4x.
## Konsekuensi & bug yang ketemu pas dikerjakan
**anime.js nulis inline style "from" SECARA SINKRON** begitu animasi
dimulai -- kalau frame berikutnya tidak pernah jalan (ditemukan: tab
browser automation testing yang `document.hidden=true` bikin
`requestAnimationFrame` beku total, tapi risiko sama berlaku buat CDN
gagal load/diblokir/`prefers-reduced-motion`), elemen nyangkut permanen
di state awal yang tidak kelihatan. **Fix:** hero (kartu 3D + data chip)
KELIHATAN LENGKAP lewat CSS statis dari awal, tanpa animasi masuk yang
menggerbangi visibility di balik JS. Idle float + scan line jadi
CSS `@keyframes` murni (bukan JS) -- kalaupun tidak pernah jalan, start/
end state-nya sama-sama sudah benar. JS (anime.js) cuma dipakai buat
bonus interaktif (tilt ikutin posisi mouse), aman karena cuma nyala
kalau tab beneran fokus/kelihatan (mousemove tidak mungkin fire di tab
background). Prinsip: **konten tidak boleh butuh animasi selesai buat
kelihatan benar** -- animasi cuma polish di atas state yang sudah valid.

Juga ketemu (tidak berhubungan sama redesign, tapi baru kelihatan pas
lihat dashboard beneran jalan): `eval/run.ts` nyimpen `timestamp` di
JSON pakai versi yang sudah di-mangle buat nama file (":" diganti "-"),
jadi `new Date(run.timestamp)` di `dashboard.html` selalu "Invalid
Date". Fix: field JSON pakai ISO 8601 asli, versi filesystem-safe cuma
buat nama file. 6 file run lama diperbaiki juga (bukan cuma yang baru).

## Revisi setelah feedback Surya
Feedback: efek hover kurang kerasa, landing page kurang jelasin maksud
sistemnya, UI kurang "jadi". Diperbaiki:
- **Hover 3D diperkuat** — rentang tilt naik dari ±11° ke ±20°, tambah
  `scale(1.05)` pas hover, DAN tambah reaksi CSS-only (`:hover` murni,
  tidak butuh JS/anime.js sama sekali) berupa box-shadow lebih dalam +
  data chip geser dikit -- jaminan ada reaksi terlihat bahkan kalau JS
  gagal jalan. Dites beneran pakai Chrome automation `hover` action
  (bukan cuma baca kode) -- kartu miring jelas ngikutin posisi kursor,
  bayangan menebal, chip bergeser.
- **Section "Cara kerjanya"** (3 langkah + ikon SVG inline) ditambah di
  antara hero dan form upload -- jelasin proses upload → AI baca+validasi
  → review, bukan cuma headline generik.
- **Stats strip** nunjukkin 3 angka asli (akurasi 90,1%, biaya $0.00096,
  p95 12,2s) langsung di landing page -- sama seperti README, sumbernya
  jelas.
- Tambah footer (link API docs/GitHub/Metrics + atribusi CORD).
