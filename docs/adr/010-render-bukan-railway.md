# 010 — Demo publik pakai Render, bukan Railway
## Konteks
Tahap 7 sebelumnya sudah siapin `railway.json` + panduan Railway
(Surya pilih Railway lewat AskUserQuestion). Tapi Surya ternyata sudah
duluan bikin akun & hubungkan project di **Render**, bukan Railway --
bikin akun/OAuth GitHub cuma bisa dilakukan Surya sendiri lewat
browser, bukan Claude Code, jadi keputusan platform akhirnya mengikuti
apa yang sudah dikerjakan Surya.
## Opsi
A) Minta Surya ulang dari nol pakai Railway.
B) Lanjutkan pakai Render yang sudah disiapkan Surya.
## Keputusan & alasan
Pilih B. Render juga cocok buat arsitektur kita: tipe service
**Background Worker** (proses jalan terus tanpa port HTTP) pas persis
buat `src/worker.ts` -- sama validnya kayak Railway buat kebutuhan ini
(worker+cron yang butuh proses hidup terus, storage/DB/queue eksternal
lewat Neon/Upstash). `railway.json` dan `docs/deploy-railway.md`
dihapus (superseded), diganti `docs/deploy-render.md`.
## Konsekuensi
Ketemu gap nyata pas nulis panduan: `package.json` tidak punya
`postinstall` buat `prisma generate` -- fresh install di Render (atau
platform manapun) bakal gagal build kalau build command tidak eksplisit
jalanin `npx prisma generate` duluan. Dicatat di panduan, bukan
ditambah `postinstall` permanen (biar tidak nambah waktu tiap `npm
install` lokal buat sesuatu yang cuma perlu di CI/deploy).
