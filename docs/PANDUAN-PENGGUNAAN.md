# Panduan penggunaan AUTOFEEDS — Fase 8

Panduan visual dengan screenshot tersedia sebagai `PANDUAN-AUTOFEEDS-fase8.html` di paket unduhan. Screenshot dan angka contoh berlabel DEMO, bukan penawaran harga produk nyata.

## Mulai dan perbarui

1. Untuk pembaruan: hentikan server, backup proyek, database dan storage.
2. Ekstrak paket. Salin source ke folder proyek tanpa menghapus database/storage.
3. Pastikan Node.js 22+ dan Python 3.10+ tersedia.
4. Klik `1-INSTAL-WINDOWS.bat` untuk instalasi awal/pembaruan dependensi.
5. Klik `2-MULAI-WINDOWS.bat`, tunggu Ready, buka `http://localhost:3000`.
6. Biarkan terminal terbuka. Ctrl+C untuk berhenti. Pada hari berikutnya cukup jalankan file nomor 2.

Alternatif terminal di folder proyek:

```bash
npm ci
python -m pip install -r requirements.txt
npm run dev
```

## Siapkan brand

Buka Brand Kit → Brand Kit baru. Isi nama, warna, font dan footer. Upload logo bila ada, atur default, lalu Simpan Brand Kit. Logo resmi belum tersedia pun kit dapat digunakan tanpa logo.

## Siapkan foto produk

Buka Image Upload → pilih/seret foto → isi nama/kategori → Simpan semua. Gunakan nama yang mudah dikenali.

Opsional: Product Image Studio → pilih foto → atur cahaya/kontras/ketajaman → Buat hasil foto. Untuk mengganti background foto biasa, pasang model penghapus background lalu pilih mode transparan/warna dan aktifkan AI. PNG yang sudah transparan dapat dipakai tanpa model tersebut. Foto asli tetap tersimpan; pilih varian hasil olahan nanti di Composer.

## Buat poster

1. Promo Composer → pilih 1–6 produk.
2. Pilih jenis promo. Masukkan harga sesuai label. Untuk Harga spesial, harga promo diisi langsung dan harga coret opsional.
3. Pilih foto asli/varian, Brand Kit dan konsep.
4. Pilih ukuran preset, atau Ukuran khusus lalu isi lebar/tinggi dalam piksel.
5. Pilih 4, 5 atau 6 variasi dan klik tombol Buat variasi desain. Mode satu desain tetap tersedia.
6. Klik thumbnail untuk membandingkan. Simpan desain pilihan memberi tanda favorit; seluruh hasil sudah masuk riwayat.
7. Unduh JPG atau PNG. Buat ulang/variasi tambahan menggunakan data tersimpan, bukan perubahan formulir yang belum dikirim.

## Edit dan ekspor

Klik Edit desain (salinan). Pilih layer dari daftar atau canvas. Drag untuk memindah; kotak untuk resize; bulatan untuk rotasi. Atur teks/font/warna/posisi pada panel Properti. Undo/redo tersedia.

Untuk ukuran khusus: isi Lebar khusus dan Tinggi khusus, klik Terapkan ukuran, periksa susunan, lalu Simpan. Sisi 512–4096 px dan rasio 1:3 sampai 3:1. Foto tetap proporsional.

- JPG: pilih kualitas 85/95/100; area transparan menjadi putih.
- PNG: menyimpan transparansi layer; sembunyikan Background jika tidak diperlukan.
- SVG: gambar tertanam, elemen vektor tetap terpisah, tetapi font tidak tertanam.

Klik Simpan/Ctrl+S untuk menyimpan dokumen. Mengunduh tidak otomatis menyimpan perubahan. Harga promo, harga coret dan diskon merupakan layer mandiri.

## Simpan template

Terapkan kit pada dokumen editor dan Simpan. Buka Brand Kit → pilih kit → pilih dokumen dan nama template → Simpan template. Gunakan template membuat salinan baru yang dapat diedit. Perubahan dokumen asal tidak mengganti template tersimpan.

## Buat caption/CTA

Buka Content Studio, pilih foto dan gunakan analisis atau isi fakta manual. Pilih brand, bahasa dan gaya, tulis info yang benar pada Info tambahan, lalu Buat konten. Ollama/model teks harus berjalan. Periksa hasil, simpan ke Content Library, salin, atau unduh TXT. Filter harga bukan verifikasi otomatis semua klaim produk.

## Jika ada kendala

- Tidak ada perubahan setelah menyalin: hentikan dan jalankan ulang server, lalu muat ulang halaman. Pastikan folder yang dijalankan adalah folder yang diperbarui.
- Node/Python tidak ditemukan: pasang prasyarat dan aktifkan PATH, lalu buka terminal baru.
- AI foto belum siap: pasang `requirements-ai.txt` dan jalankan `python scripts/setup_background_model.py`; pengaturan foto dasar tetap dapat dipakai.
- Ollama tidak terhubung: jalankan Ollama dan sesuaikan alamat/model di Settings. Poster/editor tidak memerlukan Ollama.
- Konflik revisi editor: salin dokumen jika ingin mempertahankan perubahan, atau muat ulang versi terbaru.
- Teks terlalu kecil/susunan kurang pas: gunakan canvas lebih besar atau kurangi produk, lalu rapikan layer.

Simpan backup database dan seluruh storage saat aplikasi berhenti. File BAT, Windows/perangkat pengguna dan kualitas model teks nyata masih perlu diverifikasi pada perangkat pengguna; aplikasi dan browser telah diuji pada Linux.
