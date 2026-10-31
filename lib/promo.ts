import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { UPLOAD_DIR } from "./storage";

const execFileAsync = promisify(execFile);

export const PROMO_DIR = path.join(UPLOAD_DIR, "promo");
const SCRIPT = path.join(process.cwd(), "scripts", "compose_promo.py");
const SAFE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$/;

export type PromoSpecItem = {
  path: string;
  image_id?: number;
  variant_id?: number | null;
  name: string;
  price_text: string;
  old_text: string;
  tag: string;
};

export type PromoSpec = {
  format: string;
  width?: number;
  height?: number;
  theme: string;
  seed: number;
  style?: string;
  layout_variant?: number;
  brand?: { name: string; primary_color: string; secondary_color: string; accent_color: string; font_family: string; logo_path: string | null };
  mode: "items" | "bundle";
  title: string;
  subtitle: string;
  footer: string;
  badge: string;
  items: PromoSpecItem[];
  bundle?: { label: string; price_text: string; old_text: string; tag: string };
};

export function promoPath(filename: string): string | null {
  return SAFE.test(filename) ? path.join(PROMO_DIR, filename) : null;
}

export async function composePromo(spec: PromoSpec): Promise<string> {
  fs.mkdirSync(PROMO_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}.jpg`;
  const out = path.join(PROMO_DIR, filename);
  const specFile = path.join(PROMO_DIR, `.spec-${crypto.randomUUID()}.json`);
  fs.writeFileSync(specFile, JSON.stringify({...spec,png_output:out.replace(/\.jpg$/, ".png")}), "utf-8");
  try {
    await execFileAsync("python", [SCRIPT, specFile, out], {
      timeout: 60_000,
      windowsHide: true,
    });
  } catch (e) {
    fs.rmSync(out,{force:true});
    fs.rmSync(out.replace(/\.jpg$/, ".png"),{force:true});
    const err = e as { stderr?: string; message?: string };
    throw new Error("Gagal menyusun desain: " + (err.stderr || err.message || "").slice(0, 300));
  } finally {
    if (fs.existsSync(specFile)) fs.unlinkSync(specFile);
  }
  return filename;
}

export function deletePromoFile(filename: string): void {
  const p = promoPath(filename);
  if(p){fs.rmSync(p,{force:true});fs.rmSync(p.replace(/\.jpg$/, ".png"),{force:true});}
}