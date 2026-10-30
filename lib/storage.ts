import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getSetting } from "./db";

export const UPLOAD_DIR = path.join(process.cwd(), "storage", "uploads");

export type ImageType = { mime: string; ext: string };

export type ValidationResult =
  | { ok: true; type: ImageType }
  | { ok: false; error: string };

export function ensureUploadDir(): void {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export function getMaxUploadBytes(): number {
  const mb = Number(getSetting("max_upload_mb"));
  return (Number.isFinite(mb) && mb > 0 ? mb : 10) * 1024 * 1024;
}

// Deteksi jenis gambar dari isi file, bukan dari nama/ekstensi
export function detectImageType(buf: Buffer): ImageType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: "image/jpeg", ext: ".jpg" };
  }
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length >= 8 && buf.subarray(0, 8).equals(pngSig)) {
    return { mime: "image/png", ext: ".png" };
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", ext: ".webp" };
  }
  return null;
}

export function validateImage(buf: Buffer): ValidationResult {
  if (buf.length === 0) {
    return { ok: false, error: "File kosong." };
  }
  const max = getMaxUploadBytes();
  if (buf.length > max) {
    return {
      ok: false,
      error: `Ukuran file melebihi batas ${Math.round(max / 1024 / 1024)} MB.`,
    };
  }
  const type = detectImageType(buf);
  if (!type) {
    return {
      ok: false,
      error: "Format tidak didukung. Gunakan JPG, JPEG, PNG, atau WEBP.",
    };
  }
  return { ok: true, type };
}

// Nama untuk ditampilkan: buang path dan karakter berbahaya
export function sanitizeDisplayName(name: string): string {
  const base = path.basename(name).replace(/[\u0000-\u001f<>:"/\\|?*]/g, "_");
  return base.trim().slice(0, 100) || "gambar";
}

export function saveImage(buf: Buffer): {
  storedFilename: string;
  mime: string;
  sizeBytes: number;
} {
  const result = validateImage(buf);
  if (!result.ok) throw new Error(result.error);

  ensureUploadDir();
  const storedFilename = `${crypto.randomUUID()}${result.type.ext}`;
  // flag "wx": gagal jika file sudah ada, jadi tidak pernah menimpa
  fs.writeFileSync(path.join(UPLOAD_DIR, storedFilename), buf, { flag: "wx" });

  return {
    storedFilename,
    mime: result.type.mime,
    sizeBytes: buf.length,
  };
}

// Hanya nama file hasil buatan sistem yang diterima (cegah path traversal)
const SAFE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function resolveUploadPath(storedFilename: string): string | null {
  if (!SAFE_NAME.test(storedFilename)) return null;
  return path.join(UPLOAD_DIR, storedFilename);
}

export function deleteImageFile(storedFilename: string): boolean {
  const p = resolveUploadPath(storedFilename);
  if (!p || !fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}