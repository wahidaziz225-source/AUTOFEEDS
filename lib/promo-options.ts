export const MAX_PROMO_ITEMS = 6;

export const PROMO_FORMATS = [
  { id: "feed", label: "Feed Instagram 4:5 (1080×1350)" },
  { id: "square", label: "Persegi 1:1 (1080×1080)" },
  { id: "story", label: "Story / Reels 9:16 (1080×1920)" },
  { id: "landscape", label: "Facebook 1,91:1 (1200×630)" },
] as const;

export const PROMO_THEMES = [
  {
    id: "acak",
    label: "Acak (variatif)",
    bg: "conic-gradient(#dc2626, #2563eb, #7c3aed, #16a34a, #f97316, #dc2626)",
  },
  { id: "merah", label: "Merah", bg: "#dc2626" },
  { id: "biru", label: "Biru", bg: "#2563eb" },
  { id: "ungu", label: "Ungu", bg: "#7c3aed" },
  { id: "oranye", label: "Oranye", bg: "#f97316" },
  { id: "hijau", label: "Hijau", bg: "#16a34a" },
  { id: "pink", label: "Pink", bg: "#db2777" },
  { id: "tosca", label: "Tosca", bg: "#0d9488" },
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
  const d = (s ?? "").replace(/\D/g, "");
  return d ? Number(d) : null;
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
  return n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n);
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