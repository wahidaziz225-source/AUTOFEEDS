# Fase 7 — Brand Kit dan Content Studio

Baseline Fase 6: `abbc33c`. Dikerjakan 1 November 2026.

## Brand Kit

Buka menu **Brand Kit**, buat kit baru, isi nama, upload logo bila tersedia, lalu atur:

- Warna utama, sekunder, dan aksen.
- Font lokal utama dan footer/kontak.
- Panduan gaya bahasa (maksimal 600 karakter).
- Konsep, ukuran, judul dan badge awal untuk promosi.
- Gaya bahasa serta bahasa konten awal.
- Kit default untuk pemakaian berikutnya.

Klik **Simpan Brand Kit**. Kit tidak memerlukan logo agar dapat digunakan. Logo PNG transparan dianjurkan untuk komposisi; JPG/WEBP juga diterima melalui upload yang sudah ada. Tidak ada pembuatan logo palsu/otomatis.

Pengaturan disimpan lokal dengan revisi. Menjadikan kit lain sebagai default hanya menyisakan satu default dan memperbarui revisi kit terdahulu. Tab yang membawa revisi lama diminta memuat ulang. Kit dapat dihapus tanpa menghapus poster, caption, atau template yang telah dibuat.

## Promo Composer

Kit default dimuat sebelum formulir aktif. Memilih kit lain mengisi pengaturan awal judul, badge, footer, konsep dan ukuran; pengguna masih dapat mengubah nilai tersebut untuk promo ini. Pilih **Tanpa Brand Kit** untuk memakai perilaku warna tema lama. Saat kit aktif, warna dari kit dipakai dan tombol warna tema dinonaktifkan.

Renderer memakai palette dan font kit. Logo ditempatkan proporsional pada area footer, dengan bidang putih di belakangnya agar kemasan dan harga tidak tertutup. Area footer tetap disediakan jika ada logo meskipun footer teks kosong. Warna tulisan pada harga/tag/header/footer disesuaikan bila palette tidak cukup kontras. Nuansa latar netral/dingin pada konsep tertentu tetap dipertahankan; warna brand digunakan pada elemen utama dan footer.

Setiap hasil menyimpan snapshot identitas brand dalam metadata dan pengaturan regenerasi. **Mengubah/menghapus kit tidak mengganti brand pada poster lama atau saat membuat ulang hasil tersebut.** Hasil tanpa brand dari sebelum Fase 7 tetap tanpa brand saat dibuat ulang, meskipun sekarang ada kit default.

File logo versi terdahulu dipertahankan dalam `storage/uploads/brand-assets/` untuk menjaga snapshot. Melepas logo dari kit menghentikan pemakaian pada hasil baru, bukan menghapus file yang masih mungkin dipakai hasil lama. Backup seluruh storage; penghapusan file manual dapat menyebabkan regenerasi meminta logo dipulihkan.

## Design Editor dan template

Di editor, pilih **Brand Kit editor**, lalu **Terapkan Brand Kit**. Tindakan ini:

- Memakai font dan warna kit pada teks/bentuk tanpa mengganti isi nama atau nominal harga.
- Mengganti background bitmap bernama Background menjadi bidang warna utama.
- Mengganti footer/logo brand dengan komponen baru yang terpisah.
- Menjaga foto produk dan salinan aset aslinya.

Periksa susunan, lalu klik **Simpan**. Penerapan tetap merupakan perubahan draft dan dapat di-undo. Ia tidak otomatis menulis dokumen. Footer berada di bagian bawah canvas; pada desain manual yang sudah memakai area tersebut, pengguna dapat menggeser/mengedit layer setelah penerapan. Tidak ada jaminan auto-layout ulang seluruh susunan manual.

Di Brand Kit, pilih dokumen editor yang sudah tersimpan dan **Simpan template untuk brand ini**. Template mengambil **tampilan dokumen yang dipilih**, bukan otomatis mengubahnya mengikuti warna kit. Karena itu, terapkan kit di editor dan simpan dokumen terlebih dahulu jika dibutuhkan.

Template menyimpan salinan dokumen dan aset. **Gunakan template** membuat dokumen editor baru dengan ID aset baru. Menghapus dokumen asal atau kit tidak merusak template; template dari kit yang telah dihapus tetap tercantum tanpa afiliasi brand. Menghapus template tidak menghapus dokumen yang sudah dibuat darinya. Template disembunyikan dari daftar dokumen biasa agar salinan penyimpanan tidak memenuhi daftar editor.

## Content Studio

Jenis konten yang tersedia sekarang:

- Caption Instagram/Facebook, headline, hashtag, deskripsi dan kalimat promosi.
- Call to Action, copywriting promosi, konten edukasi produk.
- Ide konten dan alternatif gaya bahasa yang sudah ada.

Gaya tambahan: **Friendly, Hard Selling, Soft Selling**. Gaya Profesional, Santai, Persuasif, Promosi, Informatif, dan Kreatif tetap didukung. Bahasa hasil dapat dipilih **Indonesia/English**. Tanpa kit, UI mengikuti bahasa default di Settings; memilih kit mengisi bahasa/gaya awal yang masih dapat diubah pengguna.

Dua sumber fakta didukung:

1. Hasil analisis gambar yang dapat diperbaiki sebelum membuat konten.
2. Fakta produk manual, tanpa harus menjalankan model vision. Isi deskripsi minimal 3 karakter dan hanya informasi yang diketahui. Foto tetap dipilih sebagai sumber penyimpanan konten.

Konten baru menyimpan fakta, info tambahan, bahasa, gaya dan snapshot brand. **Buat ulang** pada konten baru memakai snapshot tersebut, bukan data formulir yang kebetulan sudah berubah. Konten lama yang belum memiliki snapshot masih dapat dibuka, diedit, disimpan, disalin, dan diunduh; tombol buat ulangnya memakai formulir yang sedang aktif.

Simpan ke Content Library, salin clipboard dan unduhan TXT tetap tersedia. Label brand dan bahasa ditampilkan pada hasil baru. Melepas tanda simpan tidak menghapus isi.

## Batas fakta dan ketergantungan AI

Pembuatan teks tetap memanggil **Ollama yang dipasang pengguna**, bukan generator placeholder. Model teks harus tersedia di Settings dan Ollama harus berjalan. Model vision tidak diperlukan untuk alur fakta manual. Kegagalan koneksi/model atau respons kosong menampilkan error dan tidak menyimpan konten palsu.

Prompt meminta hanya menggunakan fakta yang diberikan, tidak mengarang komposisi, sertifikasi, manfaat kesehatan, cara penyimpanan/memasak, deadline atau kelangkaan stok. Panduan gaya brand diberi konteks terpisah agar tidak dijadikan fakta produk.

Filter harga membandingkan nominal rupiah yang diberikan secara eksplisit menggunakan Rp/IDR pada info tambahan (serta fakta manual bila digunakan). Format Rp25rb/Rp25.000 dipahami sebagai nominal yang sama. Angka berat dan telepon tidak dijadikan izin menyebut harga. Nominal output yang tidak diizinkan diganti **[isi harga]**. Tanda baca setelah harga ditangani tanpa membiarkan harga rekaan terlewat.

Filter ini **bukan verifikasi otomatis seluruh klaim produk**. Bahasa dan akurasi teks bergantung pada model; periksa hasil sebelum digunakan. Tidak ada klaim bahwa model selalu mematuhi setiap instruksi.

## Data dan kompatibilitas

Schema ditambah secara non-destruktif: `brand_profiles`, `brand_assets`, `brand_templates`, dan `content_context`. Tabel kit yang sudah disiapkan sebelumnya dipakai kembali. Restart server setelah pembaruan diperlukan agar tabel baru diinisialisasi.

Logo kit disalin dari foto upload, sehingga menghapus foto upload logo tidak menghapus logo versi tersimpan. Aset editor/template tetap mengikuti kepemilikan dokumen dan menolak pemakaian aset dokumen lain. Snapshot konten tidak dihapus bersama kit. `AUTOFEEDS_DATA_DIR` tetap didukung; backup database dan storage ketika server berhenti.

Kit dan template ditampilkan hingga 100 template/dokumen terbaru pada daftar yang sesuai; pagination belum ditambahkan. Logo lama yang disimpan demi riwayat tidak dibersihkan otomatis. Font memakai daftar lokal yang tersedia; jika font tidak tersedia di OS, renderer/editor memakai fallback, sehingga tipografi dapat berbeda antarperangkat.

## Validasi sesi implementasi

- TypeScript, ESLint tanpa error/warning, production build.
- **24 tes Node**, termasuk validasi kit/snapshot, penerapan brand tanpa mengubah foto/harga, penggantian footer/logo tanpa duplikasi, kontras, prompt bahasa/brand, serta filter harga/satuan/telepon/tanda baca.
- **19 tes Python dengan model CPU nyata untuk regresi foto**: semua regresi sebelumnya, serta 24 render bermerek (6 konsep × 4 format) dengan logo, palette, footer, layer dan integritas sumber. Total render yang diuji pada suite saat ini: 170, termasuk konversi dan perbandingan recorder.
- API Fase 7: CRUD/revisi/default kit, logo tetap tersedia setelah sumber dihapus, snapshot poster/konten setelah perubahan dan penghapusan kit, editor, template mandiri, sumber fakta manual dan analisis, bahasa, harga, respons kosong/error, serta persistence setelah restart.
- Browser Chromium Linux: edit/simpan kit, kit default di Composer, gunakan template, terapkan brand di editor tanpa mengganti harga, input fakta manual di Content Studio, bahasa/CTA, simpan ke Library, unduh TXT, dan pemeriksaan viewport desktop/HP.
- API Fase 4–5 dan API/browser Fase 6 dijalankan kembali dan lolos.

**Pengujian teks menggunakan server HTTP fixture yang meniru protokol Ollama** untuk menguji permintaan, snapshot, filter dan error handling. Itu tidak membuktikan kualitas jawaban model bahasa nyata. Foto AI pada regresi Fase 4 memakai model CPU lokal yang benar-benar dijalankan. Uji Windows/AMD dan HP fisik pengguna belum dilakukan.

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
```

Aktifkan `RUN_LOCAL_AI_TESTS=1` bila model foto lokal tersedia. Smoke test Fase 7 memakai data sementara terisolasi dan port 3067; server fixture Ollama menggunakan port kosong yang dipilih otomatis. Uji browser opsional memerlukan Playwright serta Chromium: `PHASE7_UI=1` dan `PHASE7_CHROMIUM` atau modul browser portable pada lingkungan pengujian. Keduanya tidak menjadi dependensi aplikasi pengguna.

## Berikutnya

Fase 8: ekspor PNG/JPG, custom size, dan pemeriksaan akhir lintas workflow. Tidak ada publikasi otomatis ke media sosial, sinkronisasi brand eksternal, atau layanan AI berbayar baru pada Fase 7.
