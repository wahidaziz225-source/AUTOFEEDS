# Hasil validasi Fase 4

Lingkungan implementasi: Linux, Node.js 24.22.1, Python 3.12, Pillow 12.3.0, ONNX Runtime 1.31.1. Model u2netp resmi telah diunduh secara eksplisit untuk pengujian dan checksum diverifikasi. Model, database, foto fixture dan dependensi lokal tidak dimasukkan ke paket source.

| Pemeriksaan | Hasil |
| --- | --- |
| TypeScript `npx tsc --noEmit` | Lolos |
| ESLint `npm run lint` | Lolos |
| Production build `npm run build` | Lolos |
| Node unit tests | 7 tes lolos, termasuk regresi harga Fase 3 |
| Python seluruh suite dengan `RUN_LOCAL_AI_TESTS=1` | 15 tes lolos, tanpa skip |
| Regresi renderer Fase 3 | 144 kombinasi geometri, 48 render JPG seluruh konsep/format/mode lolos |
| Default pengolahan | Piksel foto kecil dengan pengaturan netral dan alpha dipertahankan, sumber tidak ditimpa |
| Transparansi, background dan bayangan | Alpha dipertahankan, warna produk inti tidak dicat ulang pada fixture, posisi berada di canvas dan rasio produk tetap |
| Rotasi EXIF dan batas ukuran | Orientasi diperbaiki; sisi output dibatasi 2048 px |
| AI lokal nyata | CPU menghasilkan mask alpha; RGB sumber tetap sama sebelum enhancement/resizing |
| Model hilang/rusak | Ditolak secara eksplisit; tidak menyimpan hasil palsu |
| API dan persistence | Upload → olah foto → unduh PNG → gunakan varian di poster → unduh JPG → restart → buka varian → hapus lolos |
| Validasi API | Nilai di luar batas, foto belum terisolasi, dan varian milik foto berbeda ditolak |
| Integritas foto asli | Hash unduhan asli sebelum dan sesudah proses/penghapusan varian sama |
| Halaman | Dashboard, upload, image studio, analyzer, content studio, promo, library, history dan settings merespons HTTP 200 |
| Browser desktop/HP | Belum terverifikasi: executable Chromium tidak tersedia dan unduhan browser gagal dengan arsip kosong/terpotong |
| Windows 11 dan GPU AMD pengguna | Belum diuji langsung; pipeline AI memakai CPU |

Smoke test tanpa browser selesai menggunakan `node tests/smoke-phase4.mjs`. Uji browser opsional telah ditambahkan pada script yang sama, tetapi tidak diklaim lolos pada sesi ini. Tidak ada screenshot browser yang disertakan sebagai bukti.

Pengecekan tampilan yang perlu dilakukan di perangkat pengguna: buka Image Studio pada desktop dan HP, pilih foto, buat varian, periksa preview sebelum/sesudah dan riwayat, lalu pilih varian dari Promo Composer. Periksa juga tepi/teks kemasan pada foto produk nyata karena fixture pengujian AI bersifat sintetis.

Batas fase: belum ada batch 4–6 poster, editor layer, Brand Kit aktif, background adegan generatif, atau ekspor PNG poster. Seluruhnya tetap fase berikutnya sesuai roadmap.
