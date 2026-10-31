import { PROMO_STYLES } from "./promo-options";

export function variationCount(value: unknown): number {
  const n = value === undefined ? 1 : value;
  if (typeof n !== "number" || !Number.isInteger(n) || ![1, 4, 5, 6].includes(n)) throw new Error("Jumlah desain harus 1, 4, 5, atau 6.");
  return n;
}

// Select distinct compositions. Preferred concept leads; subsequent concepts rotate.
export function variationStyles(preferred: string, count: number, offset = 0): string[] {
  variationCount(count);
  const ids: string[] = PROMO_STYLES.map(s => s.id);
  if (!ids.includes(preferred)) throw new Error("Konsep desain tidak valid.");
  const remaining = ids.filter(id => id !== preferred);
  const shift = ((offset % remaining.length) + remaining.length) % remaining.length;
  return [preferred, ...remaining.slice(shift), ...remaining.slice(0, shift)].slice(0, count);
}
export function nextVariationStyle(style: string): string {
  const index = PROMO_STYLES.findIndex(s => s.id === style);
  return PROMO_STYLES[(index + 1) % PROMO_STYLES.length].id;
}

// Both renderer and database failures roll back completed outputs.
export async function createPromoBatch<T>(
  count: number,
  render: (index: number) => Promise<string>,
  persist: (files: string[]) => T,
  remove: (filename: string) => void,
): Promise<T> {
  const files: string[] = [];
  try {
    for (let i = 0; i < count; i++) files.push(await render(i));
    return persist(files);
  } catch (error) {
    for (const filename of files) { try { remove(filename); } catch { /* preserve original error */ } }
    throw error;
  }
}
