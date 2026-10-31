# Audit AUTOfEEDS dan implementasi Fase 3

Tanggal: 1 November 2026. Baseline: `f8159df`.

## Struktur dan kondisi aktual

- `app/`: dashboard, upload, analyzer, Content Studio, Promo Composer, library, history, settings, dan API App Router.
- `components/`: sidebar responsif dan komponen UI bersama.
- `lib/`: SQLite, validasi upload, penyimpanan lokal, Ollama, prompt, kalkulasi promo.
- `scripts/`: resize foto untuk analisis dan renderer poster Pillow.
- Stack dipertahankan: Next.js 16.4.3, React 19.3, TypeScript, Tailwind 4, better-sqlite3, Python/Pillow.
- SQLite disimpan di `database/`, gambar dan poster di `storage/uploads/`. Keduanya diabaikan Git, sehingga harus dibackup terpisah.

Fase 1–2 memiliki fondasi nyata: validasi signature gambar dan nama file UUID, query terparameterisasi, WAL/foreign keys, log aktivitas, navigasi responsif, state loading/error, dan alur Ollama dari server. Ini bukan sertifikasi bahwa seluruh kebutuhan fase awal bebas bug.

## Temuan dan tindakan

| Temuan baseline | Status |
| --- | --- |
| Variasi poster didominasi random warna/dekorasi dengan satu grid | Fase 3: enam art direction dan aturan komposisi baru |
| Diskon persen dibulatkan ke Rp100, mengubah hasil hitungan | Diperbaiki: pembulatan hanya ke rupiah terdekat |
| Parsing harga membuang semua karakter nonangka (`25rb` menjadi 25) | Diperbaiki: nominal positif dan format ribuan divalidasi, input ambigu ditolak |
| Harga coret lebih rendah dari harga promo diterima | Diperbaiki: ditolak, dengan pesan yang jelas |
| Foto gagal dibaca diabaikan dan poster tanpa foto tetap tersimpan | Diperbaiki: proses gagal dengan error |
| Tabel `designs` dan `brand_kits` ada, tetapi belum digunakan aplikasi | Tetap tersedia untuk fase 6–7; belum diklaim sebagai fitur selesai |
| Background removal/enhancement belum tersedia | Fase 4 |
| Satu request menghasilkan satu JPG | Tetap satu desain; batch 4–6 desain adalah fase 5 |
| Editor layer belum tersedia; output masih raster | Fase 6 |
| PNG/custom size belum tersedia | Fase 8 |
| Bahasa default Inggris tersedia di Settings, prompt tetap Indonesia | Backlog perbaikan Content Studio fase 7 |
| Status pekerjaan analisis disimpan di memori | Hasil tersimpan di SQLite, pekerjaan aktif tidak dilanjutkan setelah restart |
| README masih bawaan create-next-app | Ditambah petunjuk lokal dan pengujian |

## Fase 3 yang diimplementasikan

Enam konsep dipilih di Promo Composer dan divalidasi lagi pada server:

1. Premium Minimalist: latar netral, tipografi ringan, foto dan informasi berdampingan untuk satu produk; susunan baris untuk beberapa produk.
2. Flash Sale: kontras tinggi, hero produk dan rail pendukung; harga besar.
3. Modern Frozen Food: latar bernuansa dingin, bidang lengkung, panel produk bersih.
4. Editorial Creative: bidang diagonal, komposisi asimetris dan hero pada sisi berbeda.
5. Modern Retail: grid katalog yang rapi.
6. Product Spotlight: panggung gelap, foto besar, komposisi bertingkat untuk beberapa produk.

Komposisi menyesuaikan 1–6 produk, empat ukuran lama, dan bundling. Konsep disimpan pada `promo_designs.items_json.style`; tidak diperlukan migrasi destruktif. Request lama tanpa `style` menggunakan `retail`. Poster lama tetap dapat dibuka dan diunduh. Foto sumber tidak ditimpa. Nuansa frozen adalah desain latar, bukan klaim bahwa AI sudah menghapus background.

## Validasi

- TypeScript `--noEmit`, ESLint dan production build.
- Empat tes Node: parsing nominal, diskon presisi, harga manual/harga coret, ID konsep.
- Empat tes Python: 144 kombinasi geometri (6 konsep × 4 format × 6 jumlah produk), perbedaan/repeatability komposisi, 48 render JPG (6 konsep × 4 format × 2 mode), dan error foto hilang.
- Tes renderer memeriksa dimensi output, poster tidak kosong, foto sumber tidak berubah, serta panel tidak saling menimpa atau keluar area. Ini tidak membuktikan semua teks panjang di setiap kombinasi selalu ideal; tetap periksa preview untuk materi publikasi.
- Pemeriksaan visual sampel satu produk dengan nama/harga/promo.
- Smoke test halaman dan API upload → generate → download → delete dijalankan pada lingkungan Linux. Pengujian Windows 11 dan model Ollama pengguna belum dilakukan.

## Urutan lanjutan

Fase 4: pipeline foto turunan non-destruktif (original tetap tersedia), background removal lokal opsional, enhancement ringan, pengaturan cahaya/bayangan, preview sebelum/sesudah, fallback jika model tidak terpasang. Setelah itu fase 5 batch variasi, fase 6 dokumen layer/editor, fase 7 Brand Kit dan Content Studio, fase 8 ekspor dan pengujian akhir.

Kualitas akhir dengan foto produk nyata tetap perlu ditinjau. Fase 3 menyediakan komposisi deterministik lokal; bukan generasi gambar AI dan belum menjamin mutu setara kampanye brand untuk semua input.
