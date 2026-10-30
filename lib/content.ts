export const CONTENT_TYPES = [
  { id: "caption_instagram", label: "Caption Instagram" },
  { id: "caption_facebook", label: "Caption Facebook" },
  { id: "hashtag", label: "Hashtag" },
  { id: "headline", label: "Headline Promosi" },
  { id: "description", label: "Deskripsi Produk" },
  { id: "promo", label: "Kalimat Promosi" },
  { id: "ideas", label: "Ide Konten" },
  { id: "style_variants", label: "Alternatif Gaya Bahasa" },
] as const;

export const TONES = [
  { id: "profesional", label: "Profesional" },
  { id: "santai", label: "Santai" },
  { id: "persuasif", label: "Persuasif" },
  { id: "promosi", label: "Promosi" },
  { id: "informatif", label: "Informatif" },
  { id: "kreatif", label: "Kreatif" },
] as const;

export function isContentType(v: string): boolean {
  return CONTENT_TYPES.some((t) => t.id === v);
}
export function isTone(v: string): boolean {
  return TONES.some((t) => t.id === v);
}

const TYPE_INSTRUCTIONS: Record<string, string> = {
  caption_instagram:
    "Tulis 1 caption Instagram: kalimat pembuka yang menarik, isi 2-4 kalimat, ajakan bertindak di akhir, emoji secukupnya. Di baris terakhir tambahkan 5-8 hashtag.",
  caption_facebook:
    "Tulis 1 caption Facebook yang sedikit lebih panjang dan informatif (3-6 kalimat), dengan ajakan bertindak di akhir. Hashtag maksimal 3.",
  hashtag:
    "Tulis 15 hashtag yang relevan dengan produk atau gambar, dalam satu baris dipisah spasi, tanpa penjelasan.",
  headline:
    "Tulis 5 alternatif headline promosi, masing-masing maksimal 10 kata, dalam daftar bernomor.",
  description:
    "Tulis 1 deskripsi produk berupa satu paragraf (3-5 kalimat) yang menjelaskan tampilan dan manfaat berdasarkan data yang tersedia saja.",
  promo:
    "Tulis 5 kalimat promosi singkat (maksimal 20 kata), dalam daftar bernomor.",
  ideas:
    "Tulis 5 ide konten media sosial untuk produk ini. Tiap ide: judul singkat dan satu kalimat penjelasan, dalam daftar bernomor.",
  style_variants:
    "Tulis satu pesan promosi singkat (2-3 kalimat) dalam 3 gaya berbeda: Santai, Profesional, dan Persuasif. Beri label tiap gaya.",
};

export type PromptInput = {
  type: string;
  tone: string;
  description: string;
  objects: string;
  colors: string;
  visibleText: string;
  context: string;
  extra: string;
};

export function buildPrompt(i: PromptInput): string {
  const toneLabel = TONES.find((t) => t.id === i.tone)?.label ?? "Santai";
  const lines = [
    `Deskripsi gambar: ${i.description || "-"}`,
    `Objek/produk: ${i.objects || "-"}`,
    `Warna dominan: ${i.colors || "-"}`,
    `Teks pada gambar: ${i.visibleText || "-"}`,
    `Konteks: ${i.context || "-"}`,
  ];
  if (i.extra.trim()) lines.push(`Info tambahan dari pemilik produk: ${i.extra.trim()}`);

  return `Kamu adalah penulis konten media sosial berbahasa Indonesia.

DATA PRODUK:
${lines.join("\n")}

TUGAS:
${TYPE_INSTRUCTIONS[i.type] ?? TYPE_INSTRUCTIONS.caption_instagram}

Gaya bahasa: ${toneLabel}.

ATURAN WAJIB:
- Tulis dalam Bahasa Indonesia.
- Hanya gunakan fakta dari DATA PRODUK di atas.
- Jangan mengarang nama merek, harga, ukuran, diskon, bahan, atau klaim kesehatan yang tidak tertulis di data.
- Harga, promo, dan kontak hanya boleh disebut jika ada di "Info tambahan".
- Tulis hasilnya langsung, tanpa kalimat pembuka seperti "Berikut adalah" dan tanpa penjelasan tambahan.`;
}
// Hapus harga yang tidak ditulis pengguna + sisa tanda markdown
export function cleanOutput(text: string, extra: string): string {
  const allowed = new Set(
    (extra.match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(/\D/g, ""))
  );
  const priceRe = /Rp\.?\s?(\d[\d.,]*)(\s?(?:rb|ribu|k|jt|juta))?/gi;
  return text
    .replace(priceRe, (m, num: string) =>
      allowed.has(num.replace(/\D/g, "")) ? m : "[isi harga]"
    )
    .replace(/\*\*/g, "")
    .trim();
}