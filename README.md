# AUTOfEEDS

Studio konten promosi lokal: unggah foto produk, analisis melalui Ollama, buat caption dan poster, serta siapkan foto produk tanpa menimpa sumber asli.

Stack: Next.js 16.4.3, React 19.3, TypeScript, Tailwind 4, SQLite, dan Python/Pillow. Kode saat ini mencakup Creative Layout Engine (Fase 3), Product Image Studio (Fase 4), batch variasi desain (Fase 5), Design Editor berbasis layer (Fase 6), Brand Kit dan Content Studio (Fase 7), serta ekspor/ukuran khusus dan validasi akhir (Fase 8).

Panduan langkah demi langkah: [docs/PANDUAN-PENGGUNAAN.md](docs/PANDUAN-PENGGUNAAN.md). Panduan visual HTML disertakan dalam paket unduhan.

## Menjalankan di Windows 11

Pasang Node.js **22 atau lebih baru** (dibutuhkan better-sqlite3 yang digunakan proyek), serta Python 3.10+. Lingkungan pengujian memakai Node 24 dan Python 3.12.

Pastikan `node --version`, `npm --version`, dan `python --version` berhasil di terminal. Dari folder proyek:

```bash
npm ci
python -m pip install -r requirements.txt
npm run dev
```

Alternatif Windows: jalankan `1-INSTAL-WINDOWS.bat`, lalu `2-MULAI-WINDOWS.bat`. File BAT belum diuji langsung pada Windows.

Buka `http://localhost:3000`. Saat memperbarui proyek yang sudah ada, hentikan server dan backup folder `database` dan `storage` terlebih dahulu, lalu jalankan ulang server setelah memasang pembaruan.

## Fitur yang tersedia

- Upload JPG/PNG/WEBP dan penyimpanan lokal.
- Analyzer dan Content Studio berbasis Ollama; model dipilih melalui Settings dan harus sudah terpasang.
- Promo Composer: 1–6 produk atau bundling, harga tervalidasi, enam konsep komposisi, empat ukuran preset + custom 512–4096 px dan unduhan JPG/PNG.
- Product Image Studio: pencahayaan, kontras, ketajaman, isolasi produk opsional, background transparan/warna, ukuran/posisi, bayangan, riwayat varian dan unduhan PNG foto.
- Brand Kit: logo, palette, font, footer, default promosi dan template mandiri; snapshot menjaga hasil lama.
- Content Studio: fakta manual/analisis, Indonesia/English, CTA/edukasi/copywriting, dan gaya brand melalui Ollama.
- Design Editor: teks/harga/foto/bentuk sebagai layer terpisah, drag/resize/rotasi, undo/redo, penyimpanan dan unduhan JPG/PNG/SVG, transparansi PNG dan pilihan kualitas JPG.
- Batch 4–6 poster dengan konsep berbeda, galeri perbandingan, desain pilihan, dan pembuatan ulang dari pengaturan tersimpan.
- Pemilihan foto asli atau varian olahan untuk setiap produk di Promo Composer.
- Content Library, History dan Settings.

Pengolahan cahaya dan pembuatan poster tidak memerlukan Ollama. Untuk foto biasa yang belum transparan, penggantian background memerlukan model isolasi AI; PNG transparan dapat dikomposisikan langsung.

## Pemasangan AI background removal (opsional)

Dari folder proyek, gunakan Python yang sama dengan server:

```bash
python -m pip install -r requirements-ai.txt
python scripts/setup_background_model.py
```

Pemasangan mengunduh model kecil u2netp dari rilis resmi dan memverifikasi checksum. Muat ulang Product Image Studio setelah selesai. Pemrosesan memakai CPU dan tidak mengunggah foto ke layanan eksternal. Jika model belum terpasang, pengaturan foto dasar tetap tersedia; penghapusan background AI ditampilkan belum siap.

Foto asli tidak ditimpa. Hasil olahan, poster, database, caption dan riwayat disimpan lokal. Backup **database dan seluruh storage** ketika server berhenti; folder tersebut tidak termasuk Git maupun paket source.

## Pengujian

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

Smoke test memerlukan build yang telah selesai, port 3064–3068 yang bebas, dan Python/Pillow. Smoke test memakai direktori data sementara dan membersihkannya setelah selesai. Tes AI nyata membutuhkan paket/model lokal dan `RUN_LOCAL_AI_TESTS=1`; contoh PowerShell ada di panduan fase 4.

## Dokumentasi dan batas fase

- [Audit dan perubahan Fase 3](docs/AUDIT-FASE-3.md).
- [Panduan Fase 4](docs/FASE-4-PENGOLAHAN-FOTO.md).
- [Hasil validasi dan batas pengujian Fase 4](docs/VALIDASI-FASE-4.md).
- [Fase 5: variasi desain dan hasil validasi](docs/FASE-5-VARIASI-DESAIN.md).
- [Fase 6: Design Editor dan hasil validasi](docs/FASE-6-DESIGN-EDITOR.md).
- [Fase 7: Brand Kit dan Content Studio](docs/FASE-7-BRAND-KIT-CONTENT-STUDIO.md).
- [Fase 8: ekspor dan validasi akhir](docs/FASE-8-EKSPOR-DAN-VALIDASI.md).

Fase 8 telah tersedia. Untuk editor, pilih hasil Promo Composer lalu klik **Edit desain (salinan)**. PNG Fase 4 adalah foto hasil olahan. Mask AI perlu diperiksa pada preview untuk memastikan tepi kemasan dan teks tidak ikut terpotong.
