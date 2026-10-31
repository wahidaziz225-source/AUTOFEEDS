# Fase 6 — Editor desain berbasis layer

Baseline Fase 5: `cf7307c`. Dikerjakan 1 November 2026.

## Alur penggunaan

1. Buat/pilih hasil di Promo Composer, lalu klik **Edit desain (salinan)**.
2. Sistem membangun dokumen editor dari snapshot poster. JPG asal tetap tersedia.
3. Klik elemen pada canvas atau pilih dari daftar **Layer**.
4. Geser dengan drag; gunakan pegangan kotak untuk resize dan bulatan untuk rotasi. Properti numerik juga tersedia.
5. Ubah teks, font, warna, opacity, ukuran, posisi, urutan, dan perataan sesuai kebutuhan.
6. Klik **Simpan** atau Ctrl+S. Buka kembali dokumen lewat menu **Design Editor**.
7. Unduh **JPG** untuk hasil raster, atau **SVG** mandiri dengan gambar tertanam.

Editor juga mendukung canvas kosong dan **Salin dokumen**, termasuk menyalin perubahan yang belum disimpan menjadi dokumen baru.

## Fitur yang tersedia

- Canvas SVG dengan layer teks, foto/logo, persegi, lingkaran, dan path garis/dekorasi.
- Drag, resize, rotate, align kiri/tengah/kanan/atas/bawah.
- Font lokal: Arial, Impact, Georgia, Verdana, Courier New, DejaVu Sans; fallback Arial/sans-serif.
- Opacity, warna isi/garis, radius sudut pada persegi.
- Daftar layer, urutan depan/belakang, tampil/sembunyi, kunci/buka kunci.
- Tambah teks/bidang/lingkaran, ambil foto tersimpan, upload logo/foto melalui alur upload yang sudah ada.
- Duplikasi dan penghapusan layer; layer terkunci harus dibuka kuncinya sebelum dipindah/diubah geometrinya.
- Undo/redo hingga 80 langkah. Satu drag dihitung sebagai satu langkah; pengetikan dapat menghasilkan beberapa langkah.
- Zoom 10–150%; canvas dapat discroll. Empat format yang sudah tersedia dapat dipilih ulang; rasio foto tetap dipertahankan.
- Navigasi dengan keyboard: panah memindah 1 px, Shift+panah 10 px, Delete menghapus, Ctrl+Z/Y undo/redo. Saat mengetik pada input, perilaku pengetikan normal dipertahankan.

## Apa yang menjadi layer

Renderer Pillow lama diberi recorder opsional. Saat membuka salinan editor, renderer menjalankan kembali snapshot dengan seed, konsep, orientasi dan nominal yang sama, sambil mencatat geometri teks, foto dan bentuk. Ini bukan OCR terhadap JPG atau penambahan teks di atas poster datar.

Headline, baris nama produk, harga promo, harga coret, diskon, badge, footer, panel dan foto dapat dipilih sebagai layer mandiri. Nama produk yang sebelumnya terbungkus beberapa baris menjadi beberapa layer teks satu baris. Teks diedit di dalam lebar kotak menggunakan SVG `textLength`; ubah lebar/tinggi/font untuk mengatur skala tipografi.

**Gradient/dekorasi latar serta bayangan panel disimpan sebagai komponen bitmap terpisah**, bukan seluruh poster. Keduanya dikunci secara awal. Buka kunci untuk memindah/mengubah opacity, atau gunakan **Ganti gambar dengan bidang warna** untuk mengganti latar dengan warna yang dapat diedit. Bentuk panel, label, lingkaran dan garis foreground tetap elemen vektor.

Bayangan teks tipis dari renderer tidak dibawa sebagai teks duplikat, agar mengedit judul tidak meninggalkan tulisan lama di bawahnya. Perbedaan font OS dan representasi SVG dapat membuat tampilan awal sedikit berbeda dari JPG Pillow. Elemen yang melewati batas pada poster sumber disesuaikan saat konversi agar berada di canvas; editor bukan jaminan reproduksi piksel identik terhadap seluruh JPG lama.

Nominal awal diambil dari metadata poster, tidak dihitung ulang. **Harga promo, harga coret dan label diskon adalah layer mandiri**; perubahan harga manual tidak otomatis menghitung ulang diskon/label atau mengubah formulir Promo Composer. Semua perubahan editor disimpan sebagai dokumen terpisah.

## Penyimpanan dan perlindungan data

- Dokumen memakai tabel `designs` yang sudah disiapkan sejak fondasi; tabel baru `design_revisions` dan `design_assets` menambahkan revisi serta kepemilikan aset.
- Aset disalin sebagai PNG ke `storage/uploads/design-assets/` dengan ID UUID. Foto sumber tidak ditimpa. Salinan foto mempertahankan alpha dan detail hingga sisi 4096 px; pembesaran di atas resolusi aset dapat terlihat buram.
- Setelah dokumen dibuat, penghapusan foto/varian atau JPG poster sumber tidak menghapus gambar di dokumen editor.
- Jika sumber sudah hilang sebelum konversi editor, sistem meminta memakai foto yang tersedia. JPG lama tanpa snapshot tidak dapat dipisah menjadi layer secara akurat; buat poster baru dahulu.
- Menyalin dokumen membuat ID aset baru. Menghapus dokumen editor menghapus aset miliknya, bukan foto asli atau dokumen lain.
- Simpan bersifat eksplisit, bukan autosave. Undo/redo tersedia selama sesi, tidak dipulihkan setelah restart. Dokumen dan aset terakhir yang berhasil disimpan tetap tersedia setelah restart.
- Perubahan belum disimpan memunculkan konfirmasi saat menutup/meninggalkan halaman. **Salin dokumen** dapat dipakai untuk menyimpan perubahan ke dokumen baru.
- Revisi diperiksa saat menyimpan: tab dengan revisi lama menerima 409 dan tidak menimpa versi baru. Muat ulang atau gunakan Salin dokumen.
- Maksimal 400 layer, dokumen JSON 2 MB, jenis/font/warna/angka tervalidasi. Aset harus milik dokumen tersebut; tidak menerima URL gambar eksternal atau SVG mentah dari klien.
- Teks di-escape ketika menjadi SVG. Tidak ada `script`/`foreignObject` atau arbitrary HTML dalam model layer. Ini tetap aplikasi lokal sesuai fondasi proyek, bukan sistem autentikasi multiuser baru.

Backup folder database dan seluruh storage saat server berhenti. Restart server setelah pembaruan source agar tabel baru dibuat. `AUTOFEEDS_DATA_DIR` tetap didukung jika sudah digunakan.

## Unduhan

- JPG dibuat di browser dari dokumen SVG dan aset PNG lokal yang ditanam sebagai data URL; ukuran mengikuti canvas, kualitas JPEG 95%, area transparan diratakan ke putih.
- SVG bersifat mandiri untuk gambar, tetapi tidak menanam file font. Tampilan di aplikasi lain mengikuti font yang tersedia/fallback.
- Unduhan memakai perubahan editor saat ini; ekspor tidak otomatis menyimpan dokumen.
- PNG poster, custom size, dan pengujian ekspor menyeluruh tetap Fase 8. PNG foto olahan Fase 4 tetap tersedia.

## Pengujian

- TypeScript, ESLint dan production build.
- 17 tes Node: seluruh regresi fase sebelumnya, validasi model layer, penolakan URL/kode, pembatasan rotasi/geometri, perubahan format tanpa distorsi foto, escaping SVG, history undo/redo.
- 17 tes Python dengan model CPU nyata aktif: regresi pengolahan foto, 96 render poster, 48 konversi layer (6 konsep × 4 format × 2 mode), serta perbandingan byte JPG recorder aktif/nonaktif. Total 146 render pada dua kelompok tersebut dan tes perbandingan; geometri fase sebelumnya tetap diuji.
- `smoke-phase6.mjs`: keenam konsep, empat format, bundling, CRUD dokumen, salinan dokumen/aset, harga tersimpan, kepemilikan aset, konflik revisi, persistence restart, serta aset tetap tersedia setelah sumber dihapus.
- Browser Chromium Linux melalui Playwright: edit harga, undo/redo, drag, resize gambar proporsional, rotasi, duplikasi/hapus, simpan, JPG 1080×1350, SVG dengan gambar tertanam, dan tidak ada overflow halaman pada viewport desktop/HP.
- Pemeriksaan visual screenshot desktop dan HP memakai fixture sintetis. Screenshot pengujian tidak dimasukkan dalam paket source.
- Regresi API Fase 4 dan Fase 5 dijalankan ulang.

Pengujian browser dilakukan pada Chromium headless Linux dengan ukuran viewport desktop/HP; bukan pengujian sentuhan di HP fisik atau pengujian Windows 11/GPU AMD pengguna. Koleksi foto produk asli pengguna belum diuji.

```bash
npx tsc --noEmit
npm run lint
npm run build
node --test tests/*.test.mjs
python -m unittest discover -s tests -p "test_*.py"
node tests/smoke-phase4.mjs
node tests/smoke-phase5.mjs
node tests/smoke-phase6.mjs
```

Untuk tes model AI tanpa skip, aktifkan `RUN_LOCAL_AI_TESTS=1` seperti panduan Fase 4. Smoke test memakai direktori sementara dan port 3066 untuk editor. Browser opsional: set `PHASE6_UI=1` dan `PHASE6_CHROMIUM` ke executable Chromium yang tersedia; Playwright perlu terpasang dalam lingkungan uji. Browser/Playwright tidak diperlukan untuk menjalankan aplikasi normal dan tidak ditambahkan ke dependensi proyek.

## Berikutnya

Fase 7: Brand Kit dan pengembangan Content Studio. Fitur editor saat ini belum menyediakan grouping/multiselect, kurva path manual, reflow paragraf, font upload, atau kontrol gradient vektor; tidak ada tombol yang mengklaim fungsi tersebut sudah tersedia.
