# Fase 4 — Pengolahan foto produk

Baseline: Fase 3, commit `71c9961`. Dikerjakan 1 November 2026.

## Yang tersedia

- Menu **Product Image Studio**, juga dapat dibuka dari kartu foto di Image Upload.
- Preview foto asli dan varian hasil, riwayat varian, penghapusan varian, dan unduhan PNG foto.
- Pencahayaan dan kontras dibatasi 0,8–1,2×, ketajaman 1–1,5×; default netral, tanpa penyesuaian warna otomatis.
- Hapus background AI opsional melalui U2NETP dan ONNX Runtime CPU, tanpa layanan gambar berbayar atau CUDA.
- Background transparan/warna, pemotongan ruang transparan di sekitar produk, pengaturan ukuran/posisi tanpa distorsi, dan bayangan grafis lembut.
- PNG transparan yang sudah dimiliki dapat dikomposisikan tanpa model AI.
- Promo Composer dapat memilih foto asli atau varian tertentu untuk setiap produk, termasuk bundling. Server memeriksa bahwa varian memang milik foto produk tersebut.
- Renderer poster mempertahankan alpha foto hingga dikomposisikan ke panel, menghindari kotak putih dari flatten prematur.

## Cara menggunakan

1. Unggah foto seperti biasa.
2. Klik **Olah foto produk** atau buka menu **Product Image Studio**.
3. Untuk perbaikan pencahayaan biasa, gunakan background asli.
4. Untuk mengganti background dari foto biasa, pilih background transparan/warna dan aktifkan **Hapus background dengan AI lokal**. Opsi AI aktif setelah paket/model tersedia.
5. Untuk PNG transparan, cukup pilih background transparan/warna; AI tidak diperlukan.
6. Atur ukuran, posisi, dan bayangan bila menggunakan produk terisolasi.
7. Klik **Buat hasil foto**. Pengaturan belum mengubah preview sampai proses selesai; preview menampilkan varian tersimpan.
8. Periksa kemasan, logo, teks kecil dan tepi produk. Unduh PNG, atau buka Promo Composer dan pilih nomor hasil olahan pada **Foto untuk poster**.

Penggantian background tidak tersedia untuk foto biasa yang belum diisolasi. Sistem menampilkan error yang menjelaskan tindakan yang diperlukan, bukan mengklaim background sudah dihapus.

## Pemasangan

Fitur dasar:

```bash
npm ci
python -m pip install -r requirements.txt
npm run dev
```

AI background removal opsional, satu kali dari folder proyek:

```bash
python -m pip install -r requirements-ai.txt
python scripts/setup_background_model.py
```

Muat ulang halaman setelah pemasangan. Script pemasangan mengunduh model dari rilis resmi rembg ke `storage/models/u2netp.onnx`, membatasi ukuran unduhan, dan memverifikasi checksum resmi. Aplikasi tidak mengunduh model saat memproses foto. Bila paket/model tidak tersedia atau checksum rusak, opsi AI tidak siap dan request AI ditolak; pengaturan foto dasar tetap berjalan.

Pengolahan Fase 4 memakai executable `python` di PATH. Variabel lingkungan server `AUTOFEEDS_PYTHON` dapat menunjuk executable Python khusus untuk pipeline baru. Upload/resize dan renderer lama tetap memakai `python`; sebaiknya gunakan Python yang sama di PATH untuk semua fitur.

## Data dan kompatibilitas

- Tidak ada foto asli yang ditimpa. Setiap hasil merupakan PNG baru dengan nama UUID di `storage/uploads/processed/`.
- Tabel baru `image_variants` menyimpan sumber foto, nama file hasil, ukuran, pengaturan, engine dan waktu pembuatan. Foreign key `ON DELETE CASCADE` membersihkan metadata ketika foto sumber dihapus; API juga menghapus file varian.
- Menutup dan membuka kembali server tidak menghapus varian. Backup **database dan seluruh folder storage**, termasuk model, saat server berhenti.
- Request promo lama tanpa `variant_id` tetap memakai foto asli. Poster JPG lama tetap tersedia.
- File hasil belum berupa dokumen editor layer; itu Fase 6. Unduhan PNG pada fase ini adalah foto hasil olahan, bukan ekspor PNG poster Fase 8.
- Hentikan dan jalankan ulang server setelah memperbarui kode agar inisialisasi tabel baru dijalankan.
- Batas input pipeline baru: 24 megapiksel; hasil maksimal sisi 2048 px dan mengikuti rasio foto setelah koreksi orientasi EXIF.
- Satu proses pengolahan foto per server untuk membatasi penggunaan CPU/RAM. Request lain menerima 409 sampai selesai. Pekerjaan aktif tidak dilanjutkan otomatis setelah server dimatikan; hasil yang telah tersimpan tetap ada.

## Integritas dan batas kualitas

Model hanya menghasilkan mask alpha. RGB kemasan berasal dari foto sumber, tanpa inpainting, pembuatan ulang logo, penulisan teks, atau klaim produk. Penyesuaian cahaya dilakukan hanya sesuai pengaturan pengguna. Posisi/ukuran memakai resize proporsional dan komposisi gambar.

Mask AI dapat memotong sebagian kemasan atau detail transparan. Tidak ada jaminan bahwa semua teks/tepi terisolasi sempurna: periksa perbandingan dan gunakan foto asli jika kurang baik. Background baru berupa warna solid/transparan dan bayangan grafis; belum ada background adegan generatif atau pencahayaan fisik 3D.

Uji model nyata pada fase ini memakai foto fixture sintetis, bukan koleksi produk pengguna. Windows 11 dan perangkat AMD pengguna belum diuji langsung; inferensi sengaja menggunakan CPU.

## Validasi

```bash
npx tsc --noEmit
npm run lint
npm run build
node --test tests/*.test.mjs
python -m unittest discover -s tests -p "test_*.py"
```

Tes model nyata opsional setelah pemasangan:

PowerShell:

```powershell
$env:RUN_LOCAL_AI_TESTS="1"
python -m unittest discover -s tests -p "test_product_image.py"
```

Linux/macOS:

```bash
RUN_LOCAL_AI_TESTS=1 python -m unittest discover -s tests -p 'test_product_image.py'
```

Smoke test aplikasi produksi lokal (setelah build, gunakan port 3064 yang belum dipakai):

```bash
node tests/smoke-phase4.mjs
```

Smoke test membuat dan menghapus record fixture sendiri, memeriksa upload, pengolahan, unduhan, validasi, integritas foto sumber, pemilihan varian di poster, persistence setelah restart, dan penghapusan. Pada versi script sejak Fase 5, database dan file pengujian memakai direktori data sementara yang dihapus setelah selesai. Uji browser opsional memerlukan Playwright dan Chromium yang sudah terpasang (`PHASE4_UI=1` pada Linux/macOS, atau variabel lingkungan PowerShell). Playwright bukan dependensi fungsi aplikasi.

Hasil pengujian sesi implementasi dicatat pada `docs/VALIDASI-FASE-4.md`.

## Referensi implementasi AI

Preprocessing/model dan checksum mengikuti [U2netpSession resmi rembg](https://github.com/danielgatis/rembg/blob/main/rembg/sessions/u2netp.py). Model diambil dari [rilis model resmi](https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx). Fungsi enhancement menggunakan [Pillow ImageEnhance](https://pillow.readthedocs.io/en/stable/reference/ImageEnhance.html). Tidak diperlukan paket rembg; pipeline menggunakan ONNX Runtime langsung dan model lokal yang telah diverifikasi.
