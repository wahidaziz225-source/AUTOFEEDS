export const PROMO_STYLES = [
  { id: "premium", label: "Premium Minimalist", hint: "Ruang lega, fokus produk, harga terpisah." },
  { id: "flash", label: "Flash Sale", hint: "Kontras tinggi dengan produk unggulan besar." },
  { id: "frozen", label: "Modern Frozen Food", hint: "Nuansa dingin dengan panel produk bersih." },
  { id: "editorial", label: "Editorial Creative", hint: "Komposisi asimetris dan aksen editorial." },
  { id: "retail", label: "Modern Retail", hint: "Grid katalog rapi untuk banyak produk." },
  { id: "spotlight", label: "Product Spotlight", hint: "Panggung produk dengan susunan bertingkat." },
] as const;

export const MAX_PROMO_ITEMS = 6;

export const PROMO_FORMATS = [
  { id: "custom", label: "Ukuran khusus (512–4096 px)" },
  { id: "feed", label: "Feed Instagram 4:5 (1080×1350)" },
  { id: "square", label: "Persegi 1:1 (1080×1080)" },
  { id: "story", label: "Story / Reels 9:16 (1080×1920)" },
  { id: "landscape", label: "Facebook 1,91:1 (1200×630)" },
] as const;

export const PROMO_THEMES = [
  {
    id: "acak",
    label: "Acak (variatif)",
    bg: "conic-gradient(#be123c, #1d4ed8, #6d28d9, #15803d, #ea580c, #0f172a, #be123c)",
  },
  { id: "midnight", label: "Midnight Cyber", bg: "#0f172a" },
  { id: "luxury_gold", label: "Royal Gold", bg: "#18181b" },
  { id: "sunset", label: "Sunset Rose", bg: "#e11d48" },
  { id: "emerald", label: "Emerald Fresh", bg: "#064e3b" },
  { id: "merah", label: "Merah Ruby", bg: "#be123c" },
  { id: "biru", label: "Biru Cobalt", bg: "#1d4ed8" },
  { id: "ungu", label: "Ungu Royal", bg: "#6d28d9" },
  { id: "oranye", label: "Oranye Sunset", bg: "#ea580c" },
  { id: "hijau", label: "Hijau Jade", bg: "#15803d" },
  { id: "pink", label: "Pink Mulberry", bg: "#be185d" },
  { id: "tosca", label: "Tosca Ocean", bg: "#0f766e" },
] as const;

export const PROMO_TYPES = [
  {
    id: "harga_spesial",
    label: "Harga spesial",
    hint: "Isi harga promo. Harga coret boleh dikosongkan.",
    priceLabel: "Harga promo *",
    defaultTitle: "PROMO SPESIAL",
  },
  {
    id: "diskon_persen",
    label: "Diskon persen",
    hint: "Isi harga normal. Harga setelah diskon dihitung otomatis.",
    priceLabel: "Harga normal *",
    defaultTitle: "DISKON BESAR",
  },
  {
    id: "potongan_rp",
    label: "Potongan harga (Rp)",
    hint: "Isi harga normal. Potongan dalam rupiah dihitung otomatis.",
    priceLabel: "Harga normal *",
    defaultTitle: "POTONGAN HARGA",
  },
  {
    id: "beli_gratis",
    label: "Beli X gratis Y",
    hint: "Isi harga normal satuan. Harga tampil apa adanya, label Beli X Gratis Y ditambahkan.",
    priceLabel: "Harga normal *",
    defaultTitle: "BELI GRATIS",
  },
  {
    id: "bundling",
    label: "Paket bundling",
    hint: "Pilih 2 sampai 6 produk, lalu isi satu harga paket. Harga normal tiap produk opsional (untuk menghitung hemat).",
    priceLabel: "Harga normal (opsional)",
    defaultTitle: "PAKET HEMAT",
  },
] as const;

export type PromoParams = {
  discountPercent: number;
  discountAmount: number;
  buyQty: number;
  freeQty: number;
  bundlePrice: string;
};

export function parseAmount(s: string): number | null {
  const text = (s ?? "").trim().replace(/^Rp\s*/i, "");
  if (!/^(?:\d+|\d{1,3}(?:[.,]\d{3})+)$/.test(text)) return null;
  const n = Number(text.replace(/[.,]/g, ""));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function formatRupiah(n: number): string {
  return "Rp" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Angka murni jadi format rupiah, teks lain (misalnya "Rp25rb") dipakai apa adanya
function show(s: string): string {
  const t = s.trim();
  const n = parseAmount(t);
  return n != null && /^[\d.,]+$/.test(t) ? formatRupiah(n) : t;
}

function roundNice(n: number): number {
  return Math.round(n); // Hanya pembulatan rupiah, tidak ke ratusan.
}

export type Computed =
  | { ok: true; priceText: string; oldText: string; tag: string }
  | { ok: false; error: string };

export function computeItem(
  type: string,
  p: PromoParams,
  price: string,
  oldPrice: string
): Computed {
  const priceT = (price ?? "").trim();
  if (!priceT) return { ok: false, error: "Harga belum diisi." };

  if (type === "harga_spesial") {
    const a = parseAmount(priceT);
    const b = parseAmount(oldPrice ?? "");
    if (a == null) return { ok: false, error: "Harga promo harus berupa nominal rupiah positif (contoh 25000)." };
    if ((oldPrice ?? "").trim() && (b == null || b <= a)) {
      return { ok: false, error: "Harga normal harus lebih besar dari harga promo." };
    }
    let tag = "";
    if (a && b && b > a) {
      const pct = Math.round(((b - a) / b) * 100);
      if (pct >= 1) tag = `-${pct}%`;
    }
    return {
      ok: true,
      priceText: show(priceT),
      oldText: (oldPrice ?? "").trim() ? show(oldPrice) : "",
      tag,
    };
  }

  const n = parseAmount(priceT);
  if (type === "beli_gratis") {
    if (!n) return { ok: false, error: "Harga harus berupa angka positif." };
    return {
      ok: true,
      priceText: show(priceT),
      oldText: "",
      tag: `BELI ${p.buyQty} GRATIS ${p.freeQty}`,
    };
  }
  if (!n) return { ok: false, error: "Harga normal harus berupa angka." };

  if (type === "diskon_persen") {
    const promo = roundNice((n * (100 - p.discountPercent)) / 100);
    return {
      ok: true,
      priceText: formatRupiah(promo),
      oldText: formatRupiah(n),
      tag: `-${p.discountPercent}%`,
    };
  }
  if (type === "potongan_rp") {
    if (p.discountAmount >= n) {
      return { ok: false, error: "Potongan harus lebih kecil dari harga normal." };
    }
    return {
      ok: true,
      priceText: formatRupiah(n - p.discountAmount),
      oldText: formatRupiah(n),
      tag: `HEMAT ${formatRupiah(p.discountAmount)}`,
    };
  }
  return { ok: false, error: "Jenis promo tidak dikenal." };
}