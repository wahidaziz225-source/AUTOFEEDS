# AUTOfEEDS

Studio promosi lokal yang berfokus pada Auto Feeds Express: unggah foto produk, siapkan informasi promo, lalu hasilkan poster dan caption untuk media sosial.

Stack: Next.js 16.4.3, React 19.3, TypeScript, Tailwind 4, SQLite, dan Python/Pillow.

Panduan langkah demi langkah: [docs/PANDUAN-PENGGUNAAN.md](docs/PANDUAN-PENGGUNAAN.md).

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

- **Auto Feeds Express** (`/express`, halaman utama): unggah foto produk, isi judul/tagline/harga, lalu hasilkan tiga variasi poster dan caption Instagram.
- Unggah poster referensi untuk memberi arahan gaya pada generator yang mendukungnya.
- Revisi poster dengan instruksi singkat seperti “lebih gelap”, “minimal”, atau “layout tengah”. Instruksi yang tidak didukung akan ditolak dengan petunjuk, bukan membuat duplikat tanpa perubahan.
- Hasil dan data disimpan lokal; poster dapat diunduh sebagai JPG atau PNG.

### Penyedia AI

- **Teks, caption, dan analisis gambar**: Google Gemini API atau Ollama lokal.
- **Visual poster**: OpenAI GPT Image dan Gemini Image menghasilkan poster penuh. Cloudflare FLUX membuat latar visual yang kemudian disusun oleh renderer Auto Feeds. Renderer lokal tidak memerlukan API gambar.
- Kunci API disimpan di database lokal dan tidak dikirim kembali ke browser. Saat menggunakan penyedia API, foto dan teks yang diperlukan dikirim ke layanan tersebut.
- Skor kualitas tersedia untuk poster renderer lokal; poster penuh dari OpenAI/Gemini tidak memiliki skor renderer.

### Variabel lingkungan

- `AUTOFEEDS_PYTHON`: perintah/path Python yang dipakai server (default `python`), misalnya `python3` atau path virtualenv.
- `AUTOFEEDS_DATA_DIR`: lokasi folder induk `database` dan `storage` (default folder proyek).

Pembuatan poster lokal tidak memerlukan Ollama. Foto produk yang belum transparan dapat memakai model isolasi AI opsional; PNG transparan dapat diproses langsung.

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
