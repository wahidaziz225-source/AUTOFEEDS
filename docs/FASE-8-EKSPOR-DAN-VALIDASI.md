# Fase 8 — Ekspor dan validasi akhir

Baseline Fase 7: `06d6929`. Dikerjakan 1 November 2026.

## Perubahan dari Fase 7

| Bagian | Fase 7 | Fase 8 |
| --- | --- | --- |
| Unduhan Promo Composer | JPG | JPG dan PNG |
| Unduhan editor | JPG/SVG | JPG/PNG/SVG |
| Ukuran canvas | Empat preset | Preset + ukuran khusus |
| Kualitas JPG editor | 95% tetap | Pilihan 85%, 95%, 100% |
| Transparansi poster | SVG mengikuti layer | PNG juga mengikuti transparansi layer |
| Tipografi renderer | Font minimum dapat terlalu besar untuk kotak kecil | Font dipilih dari anggaran ruang nama/harga; harga coret dan promo dipisahkan |
| Header/label | Beberapa kombinasi rapat | Header memperhitungkan subjudul; ruang nama tidak bertabrakan dengan badge diskon pendek |
| Penggunaan Windows | Perintah terminal | Dua file BAT pendamping + panduan visual |

Ukuran khusus tersedia pada Promo Composer, canvas editor baru, dan pengubahan canvas editor. Batas: setiap sisi **512–4096 px**, bilangan bulat, rasio antara **1:3 dan 3:1**. Batas ini menghindari canvas sangat sempit dan menjaga penggunaan memori. Preset tetap: 1080×1350, 1080×1080, 1080×1920 dan 1200×630. Pengaturan awal Brand Kit tetap memilih preset; ukuran khusus ditetapkan per promo/dokumen.

## Ekspor

Poster baru menghasilkan JPG kualitas 95 dan PNG dari canvas renderer yang sama. PNG baru tidak dibuat dari JPEG, sehingga tidak menambah tahap kompresi lossy. Poster tetap merupakan komposisi dengan background; format PNG saja tidak otomatis membuat background transparan.

Untuk poster lama yang hanya mempunyai JPG, unduhan PNG pertama dikonversi dari JPG tersimpan dengan ukuran tetap. Konversi ini tidak mengembalikan detail yang sudah hilang dalam JPEG. Jika foto sumber masih tersedia, buat ulang poster untuk mendapatkan PNG langsung dari renderer baru.

Editor mengekspor perubahan saat ini, termasuk yang belum disimpan. **Ekspor tidak otomatis menyimpan dokumen.** PNG mempertahankan alpha; sembunyikan layer Background jika perlu transparansi. JPG meratakan area transparan ke putih. SVG menanam gambar PNG lokal sebagai data URL, tetapi tidak menanam font. Kualitas 85/95/100 hanya memengaruhi JPG editor, bukan PNG/SVG atau JPG generator yang tetap 95.

Pengubahan format menjaga rasio foto/logo. Komponen background dan bayangan seluruh canvas menyesuaikan area canvas. Teks dan bentuk diposisikan ulang proporsional dan dibatasi di dalam canvas. Periksa komposisi setelah mengubah rasio; resize bukan auto-layout editorial ulang.

File PNG pendamping dibersihkan bersama JPG ketika poster dihapus atau batch gagal. Format file invalid dan ukuran di luar batas ditolak. File lama tetap dapat dibuka dan diregenerasi dengan snapshot brand/fakta seperti sebelumnya. Foto sumber tidak ditimpa.

## Cara memperbarui

1. Hentikan server dan backup folder proyek, terutama `database` dan `storage`.
2. Ekstrak paket Fase 8, salin source ke proyek Anda; jangan hapus data lama.
3. Jalankan `1-INSTAL-WINDOWS.bat` untuk dependensi dasar, atau gunakan `npm ci` dan `python -m pip install -r requirements.txt`.
4. Jalankan `2-MULAI-WINDOWS.bat`, atau `npm run dev`.
5. Tunggu Ready dan buka `http://localhost:3000`.

File BAT memeriksa Node.js minimal 22 serta Python minimal 3.10, menampilkan error jika instalasi belum selesai, dan tidak mengunduh model AI secara diam-diam. File BAT **belum dijalankan langsung pada Windows** dalam sesi ini; perintah aplikasi diuji pada Linux. Node 24.22.1, Python 3.12, Pillow 12.3.0 dan ONNX Runtime 1.31.1 digunakan pada pengujian.

AI foto tetap opsional melalui `requirements-ai.txt` dan script pemasangan model. Content Studio tetap memerlukan Ollama/model teks yang dipasang dan dijalankan pengguna. Poster, editor dan pengaturan cahaya dasar dapat dipakai tanpa model teks.

## Validasi akhir

- TypeScript, ESLint, production build: lolos.
- **27 tes Node + 21 tes Python = 48 tes otomatis**: seluruhnya lolos, tanpa skip pada sesi dengan model foto lokal aktif.
- Suite Python mencakup 218 eksekusi render poster, termasuk preset, konversi layer, branding dan 48 kombinasi custom (6 konsep × 4 ukuran × 2 mode). JPG/PNG sesuai dimensi; sumber tidak berubah; harga tetap lengkap; harga coret dan promo tidak bertumpuk pada fixture custom yang diuji.
- Uji browser ekspor: PNG transparan 960×720 dan 1360×900, JPG berlatar putih, perubahan kualitas JPG menghasilkan data file berbeda, SVG mengikuti canvas, batch custom di Composer dan unduhan PNG 1200×800.
- Uji API: empat preset, custom batch, dimensi/MIME, PNG untuk JPG lama, penolakan ukuran/format invalid, regenerasi/edit custom, persistence restart dan integritas foto asli.
- Regresi API Fase 4–5 serta API/browser Fase 6–7: lolos.
- Halaman dashboard, upload, image studio, analyzer, promo, editor, Brand Kit, Content Studio, library, history dan settings merespons HTTP 200.
- Pemeriksaan visual desktop/HP memakai data DEMO. Screenshot dalam panduan bukan foto/harga dagangan aktual.

Uji browser memakai Chromium headless Linux dengan viewport desktop/HP, bukan HP fisik. Windows 11/GPU AMD pengguna belum diuji langsung. Model foto CPU dijalankan nyata; alur teks diuji menggunakan fixture HTTP protokol Ollama, bukan evaluasi kualitas model bahasa nyata. Font dapat berbeda antar-OS dan file sumber beresolusi rendah tidak menjadi tajam hanya karena canvas diperbesar.

Pengujian ini membuktikan kasus yang diuji, bukan bahwa setiap kombinasi foto, panjang teks, palette atau perangkat akan menghasilkan desain ideal. Untuk canvas kecil dengan banyak produk, teks dapat mengecil; gunakan ukuran preset yang besar atau kurangi produk, lalu rapikan melalui editor.

## Perintah pemeriksaan

```bash
npx tsc --noEmit
npm run lint
npm run build
node --test tests/*.test.mjs
python -m unittest discover -s tests -p "test_*.py"
node tests/smoke-phase4.mjs
node tests/smoke-phase5.mjs
node tests/smoke-phase6.mjs
node tests/smoke-phase7.mjs
node tests/smoke-phase8.mjs
```

Aktifkan `RUN_LOCAL_AI_TESTS=1` jika model foto tersedia. Smoke test Fase 8 memakai direktori data sementara dan port 3068. Browser opsional: `PHASE8_UI=1` dengan `PHASE8_CHROMIUM` atau modul browser portable pada lingkungan pengujian; Playwright tidak menjadi dependensi aplikasi pengguna.

## Status pekerjaan

Fase 3–8 telah diimplementasikan pada salinan kerja, di atas fondasi fase 1–2 dari repository awal. Paket source lengkap dan panduan dapat diterapkan pada proyek lokal. Perubahan belum dikirim ke GitHub dan tidak dipublikasikan ke layanan hosting/media sosial.

Tetap di luar cakupan yang diimplementasikan: background adegan generatif, reflow paragraf/multiselect/grouping editor, embedding/upload font, pagination semua galeri, antrean AI persisten saat server dimatikan, dan verifikasi otomatis seluruh klaim produk. Batas tersebut telah dicatat pada laporan fase terkait, bukan disembunyikan sebagai tombol placeholder.
