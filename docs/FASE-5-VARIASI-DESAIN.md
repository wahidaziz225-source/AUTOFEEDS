# Fase 5 — Multiple Design Variations

Baseline Fase 4: `9d62a5e`. Dikerjakan 1 November 2026.

## Fitur

- Pilihan **1 desain**, **4 variasi**, **5 variasi**, atau **6 variasi** pada Promo Composer. Default UI: 4 variasi. API lama tanpa `count` tetap menghasilkan satu desain dan mengembalikan `id` seperti sebelumnya.
- Setiap batch memakai konsep berbeda dari enam konsep Creative Layout Engine. Konsep pilihan pengguna menjadi desain pertama. Pemilihan konsep selanjutnya berputar, bukan sekadar mengganti warna.
- Alternatif ditampilkan sebagai galeri; klik untuk melihat preview lebih besar dan mengunduh JPG.
- **Simpan desain pilihan** menyimpan tanda favorit di SQLite. Semua hasil yang berhasil dibuat sudah masuk riwayat; melepas tanda pilihan tidak menghapus poster.
- **Buat ulang desain terpilih** membuat satu poster baru dengan konsep berikutnya dan orientasi komposisi berbeda. Poster lama tetap tersedia.
- **Buat variasi tambahan** membuat batch baru dari pengaturan desain terpilih, berisi 4–6 hasil. Jika pilihan jumlah pada formulir adalah 1, tombol ini membuat 4 variasi.
- Pembuatan ulang memakai snapshot tersimpan: nama, harga, jenis promo, ukuran, teks, tema, ID foto dan ID foto olahan. Perubahan formulir saat ini tidak ikut diterapkan. Untuk memakai data baru, gunakan tombol utama pembuatan dari formulir.
- Galeri riwayat menampilkan 100 poster terbaru; filter **Hanya desain pilihan** mengambil 100 poster pilihan terbaru secara terpisah, sehingga pilihan tidak hilang hanya karena keluar dari 100 poster umum terbaru. Semua record lain tetap berada di database, tetapi pagination belum disediakan.

## Perbedaan visual

Batch memilih 4–6 konsep komposisi berbeda. Ada susunan foto/informasi berdampingan, hero dengan produk pendukung, grid katalog, serta susunan bertingkat. Orientasi komposisi dapat dibalik dan judul digeser tanpa membalik piksel foto atau tulisan kemasan.

Pilihan warna pengguna tetap dihormati; pengujian enam desain dengan tema merah yang sama menghasilkan enam JPEG berbeda. Ini adalah rendering layout lokal, bukan generasi gambar AI baru. Produknya tetap memakai foto asli/olahan yang dipilih, dan harga dihitung sekali untuk seluruh batch.

Membuat ulang satu desain sengaja beralih konsep untuk memberi hasil komposisi berbeda. Belum ada kontrol untuk membuat ulang hanya satu elemen, mengedit layer, atau mempertahankan semua posisi sambil mengubah objek tertentu; itu fase editor berikutnya.

## Penyimpanan dan kegagalan

Tabel tambahan `promo_generation` menyimpan batch ID, snapshot input, konsep, seed, orientasi, tanda pilihan dan hubungan dengan desain sumber. Tabel `promo_designs` dan JPG lama tetap digunakan. Tidak ada perubahan destruktif pada schema lama; restart server diperlukan setelah pembaruan agar tabel tambahan diinisialisasi.

Render dijalankan berurutan untuk membatasi penggunaan CPU/RAM. Satu request generate aktif per proses server; request generate kedua dan penghapusan poster menerima 409 sampai selesai. UI menampilkan proses berjalan dan menonaktifkan kontrol formulir. Belum ada antrean persisten atau persentase progres.

Jika satu render gagal, file batch yang sudah selesai dibersihkan. Setelah semua render selesai, seluruh record dan log disimpan dalam satu transaksi SQLite. Jika transaksi gagal, file hasil dibersihkan. Tes unit menyimulasikan kegagalan renderer dan database untuk memeriksa mekanisme ini. Mematikan paksa server di tengah proses tetap dapat meninggalkan file tanpa record; pekerjaan aktif tidak otomatis dilanjutkan. Database, storage, dan snapshot yang sudah berhasil disimpan bertahan setelah restart.

Poster lama sebelum Fase 5 masih dapat dibuka, diunduh, ditandai sebagai pilihan dan dihapus. Karena tidak memiliki snapshot lengkap, tombol buat ulang tidak ditampilkan; API menolak upaya tersebut dengan pesan untuk membuat desain baru dari formulir. Menghapus foto sumber/varian tidak menghapus JPG poster yang sudah jadi, tetapi pembuatan ulang akan menampilkan error jika sumber tersebut sudah tidak tersedia.

## API

- `POST /api/promo` dengan input lama dan `count: 4 | 5 | 6` membuat batch.
- Respons 201: `{ id, batch_id, designs }`; `id` pertama tetap tersedia untuk kompatibilitas.
- `POST /api/promo` dengan `{ regenerate_id }` membuat satu hasil baru dari snapshot.
- `POST /api/promo` dengan `{ source_id, count: 4 | 5 | 6 }` membuat batch tambahan dari snapshot.
- `PATCH /api/promo` dengan `{ id, is_saved: true | false }` mengatur tanda pilihan.
- `GET /api/promo?batch_id=...` memuat satu kelompok desain.
- `GET /api/promo?saved=1` memuat daftar pilihan terbaru.
- Endpoint file dan penghapusan lama tetap digunakan. Regenerasi tidak mengganti JPG lama sehingga cache unduhan tidak menjadi usang.

## Validasi sesi implementasi

- TypeScript, ESLint, production build.
- 12 tes Node: regresi nominal harga, validasi jumlah, keunikan konsep, urutan render, pembersihan file saat renderer gagal dan saat persistensi gagal.
- 15 tes Python dengan model AI lokal aktif: regresi foto, mask CPU, geometri, dan 96 render JPG (6 konsep × 4 format × 2 mode × 2 orientasi). Pemeriksaan dimensi/nonkosong dan foto sumber tetap diterapkan.
- Smoke test produksi `tests/smoke-phase5.mjs`: jumlah 4/5/6, JPEG berbeda pada tema sama, presisi harga, foto olahan, bundling, empat format, simpan pilihan, buat ulang dari snapshot, batch tambahan, dukungan poster lama, validasi, respons 409, persistence setelah restart, dan sumber yang telah dihapus.
- Pemeriksaan visual contact sheet enam konsep memakai foto fixture sintetis; bukan kumpulan foto produk pengguna.
- Uji regresi alur Fase 4 dijalankan lagi.

Pengujian browser desktop/HP belum terverifikasi karena executable Chromium tidak tersedia dan unduhannya gagal pada sesi sebelumnya. Tidak ada klaim bahwa interaksi UI browser atau perangkat Windows/AMD pengguna telah diuji langsung. Render poster dan API diuji pada Linux.

## Menjalankan pengujian

```bash
npx tsc --noEmit
npm run lint
npm run build
node --test tests/*.test.mjs
python -m unittest discover -s tests -p "test_*.py"
node tests/smoke-phase4.mjs
node tests/smoke-phase5.mjs
```

Gunakan `RUN_LOCAL_AI_TESTS=1` jika paket/model lokal tersedia agar tes model CPU tidak dilewati. Smoke test memerlukan port 3064 (fase 4) dan 3065 (fase 5) yang bebas. Smoke test memakai `AUTOFEEDS_DATA_DIR` ke folder sementara yang terisolasi, termasuk database, upload, dan log. Folder uji dihapus setelah pengujian; data aplikasi utama tidak dipakai. Jika model AI lokal tersedia, salinannya disertakan hanya di folder sementara untuk regresi AI.

## Berikutnya

Fase 6 adalah editor desain berbasis layer. Tombol editor belum ditambahkan pada fase ini agar tidak ada tombol yang menjanjikan fitur yang belum tersedia. Ekspor PNG poster tetap Fase 8; PNG foto olahan Fase 4 tetap berfungsi.

## Direktori data opsional

Tanpa pengaturan tambahan, data tetap memakai folder `database` dan `storage` di proyek. Variabel lingkungan server `AUTOFEEDS_DATA_DIR` dapat diarahkan ke direktori absolut lain untuk memisahkan data dari source; gunakan nilai yang sama saat memasang model dan menjalankan server. Smoke test memakainya agar database uji tidak berbagi dengan aplikasi utama. Lokasi data tidak berubah untuk pengguna yang tidak mengatur variabel ini.

Catatan pengujian ulang: pembacaan SQLite oleh koneksi tes tambahan pada direktori kerja bersama sempat menghasilkan `SQLITE_IOERR_SHORT_READ`. Smoke test dipindahkan ke direktori sementara yang terisolasi melalui konfigurasi data opsional di atas; pengujian akhir batch, restart, dan regresi Fase 4 selesai tanpa error. Tidak dilakukan perubahan destruktif pada database pengguna untuk mengatasi kendala tersebut.
