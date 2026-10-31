export const DEFAULT_IMAGE_OPTIONS = {
  remove_background: false,
  background: "original" as "original" | "transparent" | "solid",
  background_color: "#f1f5f9",
  brightness: 1,
  contrast: 1,
  sharpness: 1,
  scale: 0.85,
  position_x: 0,
  position_y: 0,
  shadow: false,
};
export type ImageProcessingOptions = typeof DEFAULT_IMAGE_OPTIONS;
export type ImageVariant = {
  id: number; image_id: number; width: number; height: number;
  options_json: string; created_at: string;
};
export type ImageCapabilities = { ready: boolean; reason: string; engine: string };

export function validateImageOptions(value: unknown): ImageProcessingOptions {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Pengaturan foto tidak valid.");
  const v = value as Record<string, unknown>;
  const out = { ...DEFAULT_IMAGE_OPTIONS };
  for (const key of ["remove_background", "shadow"] as const) {
    if (v[key] !== undefined && typeof v[key] !== "boolean") throw new Error(`${key} harus berupa boolean.`);
    out[key] = (v[key] ?? out[key]) as boolean;
  }
  if (v.background !== undefined) {
    if (!["original", "transparent", "solid"].includes(String(v.background))) throw new Error("Background tidak valid.");
    out.background = v.background as ImageProcessingOptions["background"];
  }
  if (v.background_color !== undefined) {
    if (typeof v.background_color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(v.background_color)) throw new Error("Warna background harus berupa HEX enam digit.");
    out.background_color = v.background_color;
  }
  const ranges = { brightness: [0.8, 1.2], contrast: [0.8, 1.2], sharpness: [1, 1.5], scale: [0.4, 1], position_x: [-1, 1], position_y: [-1, 1] } as const;
  for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
    const n = v[key] ?? out[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < ranges[key][0] || n > ranges[key][1]) throw new Error(`Nilai ${key} di luar batas.`);
    out[key] = n;
  }
  if (out.remove_background && out.background === "original") throw new Error("Pilih background transparan atau warna saat menghapus background.");
  if (out.shadow && out.background === "original") throw new Error("Bayangan memerlukan produk terisolasi dan background transparan atau warna.");
  return out;
}
