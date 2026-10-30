export const MAX_PROMO_ITEMS = 6;

export const PROMO_FORMATS = [
  { id: "feed", label: "Feed Instagram 4:5 (1080×1350)" },
  { id: "square", label: "Persegi 1:1 (1080×1080)" },
  { id: "story", label: "Story / Reels 9:16 (1080×1920)" },
  { id: "landscape", label: "Facebook 1,91:1 (1200×630)" },
] as const;

export const PROMO_THEMES = [
  { id: "merah", label: "Merah", hex: "#dc2626" },
  { id: "biru", label: "Biru", hex: "#2563eb" },
  { id: "ungu", label: "Ungu", hex: "#7c3aed" },
  { id: "oranye", label: "Oranye", hex: "#f97316" },
  { id: "hijau", label: "Hijau", hex: "#16a34a" },
] as const;