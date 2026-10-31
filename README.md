This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## AUTOfEEDS — Creative Layout Engine (Fase 3)

Audit dan batas implementasi: [docs/AUDIT-FASE-3.md](docs/AUDIT-FASE-3.md).

### Menjalankan di Windows 11

1. Pasang Node.js yang memenuhi dependensi proyek dan Python 3.10+.
2. Pastikan `node --version`, `npm --version`, dan `python --version` berhasil di terminal.
3. Dari folder proyek: `npm ci` lalu `python -m pip install -r requirements.txt`.
4. Jalankan `npm run dev`, buka `http://localhost:3000`.
5. Upload foto, buka Promo Composer, isi harga, pilih konsep, lalu buat visual promo.

Renderer poster berjalan lokal tanpa Ollama. Analisis gambar dan pembuatan caption memerlukan Ollama serta model yang dipilih di Settings. Jangan menganggap model telah terpasang hanya karena namanya tercantum di pengaturan.

Foto asli, hasil poster dan database tersimpan lokal. Backup folder `database` dan `storage` saat aplikasi berhenti sebelum memindahkan komputer atau memperbarui aplikasi.

### Pemeriksaan

```bash
npx tsc --noEmit
npm run lint
npm run build
node --test tests/promo-options.test.mjs
python -m unittest discover -s tests -p "test_*.py"
```

Fase ini menghasilkan satu JPG per proses. Editor layer, batch variasi, pengolahan background dan ekspor PNG masih dikerjakan pada fase berikutnya.
