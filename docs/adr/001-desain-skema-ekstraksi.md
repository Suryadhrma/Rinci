# 001 — Desain skema ekstraksi v1
## Konteks
Sampel asli CORD lebih berantakan dari sketsa di CLAUDE.md: `menu`
kadang objek tunggal (bukan array) kalau struk cuma 1 item, dan ada
field tambahan (discount_price, itemsubtotal, creditcardprice, menu.sub
nested) yang muncul tidak konsisten antar sampel.
## Opsi
A) Ikuti semua varian field yang ada di CORD.
B) Ikuti field di sketsa CLAUDE.md saja (nm, cnt, price, unitprice /
subtotal_price, tax_price, service_price / total_price, cashprice,
changeprice) untuk v1.
## Keputusan & alasan
Pilih B. Field tambahan jarang & tidak konsisten, menambah kompleksitas
skema tanpa nilai eval yang jelas di v1. `menu` objek-tunggal
dinormalisasi jadi array via `z.preprocess`.
## Konsekuensi
Skema kecil, gampang dievaluasi. Field seperti diskon dan modifier
nested (`menu.sub`) belum tertangkap — jadi kandidat schema.v2 kalau
hasil eval nunjukkin itu signifikan.
