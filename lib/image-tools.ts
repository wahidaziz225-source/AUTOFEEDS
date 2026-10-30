import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { UPLOAD_DIR } from "./storage";

const execFileAsync = promisify(execFile);

export const AI_DIR = path.join(UPLOAD_DIR, "ai");
const SCRIPT = path.join(process.cwd(), "scripts", "resize_image.py");

export function aiFilenameFor(storedFilename: string): string {
  return storedFilename.replace(/\.(jpg|png|webp)$/, ".jpg");
}

export type ProcessResult = {
  width: number | null;
  height: number | null;
  warning?: string;
};

// Membuat versi kecil untuk AI dan membaca ukuran asli gambar (lewat Pillow)
export async function processImage(storedFilename: string): Promise<ProcessResult> {
  fs.mkdirSync(AI_DIR, { recursive: true });
  const src = path.join(UPLOAD_DIR, storedFilename);
  const dst = path.join(AI_DIR, aiFilenameFor(storedFilename));

  try {
    const { stdout } = await execFileAsync(
      "python",
      [SCRIPT, src, dst, "1024"],
      { timeout: 60_000, windowsHide: true }
    );
    const info = JSON.parse(stdout.trim()) as { width: number; height: number };
    return { width: info.width, height: info.height };
  } catch (e) {
    return {
      width: null,
      height: null,
      warning:
        "Gambar tersimpan, tetapi versi kecil untuk AI gagal dibuat: " +
        (e instanceof Error ? e.message.slice(0, 200) : String(e)),
    };
  }
}

export function deleteAiCopy(storedFilename: string): void {
  const p = path.join(AI_DIR, aiFilenameFor(storedFilename));
  if (fs.existsSync(p)) fs.unlinkSync(p);
}