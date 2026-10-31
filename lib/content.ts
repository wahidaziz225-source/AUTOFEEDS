export const CONTENT_TYPES = [
  { id: "cta", label: "Call to Action" },
  { id: "copywriting", label: "Copywriting Promosi" },
  { id: "education", label: "Konten Edukasi Produk" },
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
  { id: "friendly", label: "Friendly" },
  { id: "hard_selling", label: "Hard Selling" },
  { id: "soft_selling", label: "Soft Selling" },
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
  cta: "Tulis 5 call to action singkat dan relevan, tanpa klaim kelangkaan stok atau deadline yang tidak diberikan.",
  copywriting: "Tulis satu copywriting promosi: headline, fakta produk, alasan membeli yang didukung data, dan call to action.",
  education: "Tulis konten edukasi singkat dari fakta produk yang tersedia. Jika informasi tidak cukup, jelaskan pertanyaan yang perlu dikonfirmasi; jangan menciptakan petunjuk penyimpanan, suhu, cara masak, komposisi, atau klaim kesehatan.",
  caption_instagram:
    "Tulis 1 caption Instagram: kalimat pembuka yang menarik, isi 2-4 kalimat, ajakan bertindak di akhir, emoji secukupnya. Di baris terakhir tambahkan 5-8 hashtag.",
  caption_facebook:
    "Tulis 1 caption Facebook yang sedikit lebih panjang dan informatif (3-6 kalimat), dengan ajakan bertindak di akhir. Hashtag maksimal 3.",
  hashtag:
    "Tulis 15 hashtag yang relevan dengan produk atau gambar, dalam satu baris dipisah spasi, tanpa penjelasan.",
  headline:
    "Tulis 5 alternatif headline promosi, masing-masing maksimal 10 kata, dalam daftar bernomor.",
  description:
    "Tulis 1 deskripsi produk berupa satu paragraf (3-5 kalimat) yang menjelaskan tampilan dan fakta yang tersedia saja; manfaat hanya jika diberikan pemilik produk.",
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
  language?: "id" | "en";
  brand?: { name: string; voice: string; footer_text: string } | null;
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

  const language=i.language==='en'?'English':'Bahasa Indonesia';
  const brand=i.brand?`\nIDENTITAS BRAND (gaya dan kontak, bukan sumber klaim produk):\nNama: ${i.brand.name}\nPanduan gaya: ${i.brand.voice || '-'}\nFooter/kontak yang diberikan pemilik: ${i.brand.footer_text || '-'}\n`:'';
  return `Kamu adalah penulis konten media sosial. Bahasa keluaran wajib: ${language}.

DATA PRODUK:
${lines.join("\n")}

${brand}
TUGAS:
${TYPE_INSTRUCTIONS[i.type] ?? TYPE_INSTRUCTIONS.caption_instagram}

Gaya bahasa: ${toneLabel}.

ATURAN WAJIB:
- Tulis dalam ${language}.
- Hanya gunakan fakta dari DATA PRODUK di atas.
- Jangan mengarang nama merek, harga, ukuran, diskon, bahan, sertifikasi, komposisi, manfaat, atau klaim kesehatan yang tidak tertulis di data.
- Harga dan promo hanya boleh disebut jika diberikan secara eksplisit oleh pemilik. Kontak hanya dari Info tambahan atau footer brand.
- Panduan gaya tidak boleh menambah fakta, klaim sertifikasi, komposisi, atau manfaat produk.
- Jangan membuat urgensi stok/deadline palsu meskipun gaya hard selling.
- Tulis hasilnya langsung, tanpa kalimat pembuka seperti "Berikut adalah" dan tanpa penjelasan tambahan.`;
}
// Compare actual currency values; weights and telephone digits never authorize prices.
const PRICE = /\b(?:Rp\.?|IDR)\s*(\d+(?:[.,]\d+)*)(?:\s*(rb|ribu|k|jt|juta))?(?![A-Za-z0-9]|[.,]\d)/gi;
export function priceValue(number:string,suffix=''):number|null{
  const unit=suffix.toLowerCase();let value:number;
  if(unit){
    if(!/^\d+(?:[.,]\d{1,3})?$/.test(number))return null;
    value=Number(number.replace(',','.'))*(/^(jt|juta)$/.test(unit)?1_000_000:1000);
  }else{
    if(!/^(?:\d+|\d{1,3}(?:[.,]\d{3})+)$/.test(number))return null;
    value=Number(number.replace(/[.,]/g,''));
  }
  return Number.isSafeInteger(value)&&value>0?value:null;
}
export function cleanOutput(text: string, authorizedFacts: string): string {
  const allowed=new Set<number>();
  for(const match of authorizedFacts.matchAll(new RegExp(PRICE.source,'gi'))){const value=priceValue(match[1],match[2]);if(value!==null)allowed.add(value);}
  return text.replace(new RegExp(PRICE.source,'gi'),(whole,number:string,suffix:string)=>{
    const value=priceValue(number,suffix);return value!==null&&allowed.has(value)?whole:'[isi harga]';
  }).replace(/\*\*/g,'').trim().slice(0,10000);
}
