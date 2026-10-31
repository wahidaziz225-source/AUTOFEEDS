import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { UPLOAD_DIR } from "./storage";
import type { ImageCapabilities, ImageProcessingOptions } from "./image-processing-options";

const execFileAsync = promisify(execFile);
export const PROCESSED_DIR = path.join(UPLOAD_DIR, "processed");
const SCRIPT = path.join(process.cwd(), "scripts", "product_image.py");
const g = globalThis as unknown as { __photoProcessingImage?: number };
export function processingImageId() { return g.__photoProcessingImage; }
export function beginPhotoProcessing(imageId: number): boolean {
  if (g.__photoProcessingImage !== undefined) return false;
  g.__photoProcessingImage = imageId;
  return true;
}
export function finishPhotoProcessing() { delete g.__photoProcessingImage; }
export function processedPath(filename: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/.test(filename)
    ? path.join(PROCESSED_DIR, filename) : null;
}
export function deleteProcessedFile(filename: string) {
  const p = processedPath(filename);
  if (p) fs.rmSync(p, { force: true });
}
export class PhotoProcessingError extends Error {
  constructor(message: string, public code: string) { super(message); }
}
export async function photoCapabilities(): Promise<ImageCapabilities> {
  try {
    const { stdout } = await execFileAsync(process.env.AUTOFEEDS_PYTHON || "python", [SCRIPT, "--capabilities"], { timeout: 20_000, windowsHide: true });
    return JSON.parse(stdout.trim()) as ImageCapabilities;
  } catch {
    return { ready: false, reason: "Python/Pillow tidak dapat diperiksa. Ikuti petunjuk pemasangan dan periksa Python server.", engine: "U2NETP / ONNX Runtime CPU" };
  }
}
export async function createProcessedPhoto(source: string, options: ImageProcessingOptions) {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}.png`;
  const destination = processedPath(filename)!;
  const specFile = path.join(PROCESSED_DIR, `.spec-${crypto.randomUUID()}.json`);
  fs.writeFileSync(specFile, JSON.stringify({ source, destination, options }), { flag: "wx" });
  try {
    const { stdout } = await execFileAsync(process.env.AUTOFEEDS_PYTHON || "python", [SCRIPT, specFile], { timeout: 120_000, windowsHide: true });
    const info = JSON.parse(stdout.trim()) as { width: number; height: number; engine: string };
    if (!Number.isInteger(info.width) || !Number.isInteger(info.height) || info.width < 1 || info.height < 1 || info.width > 2048 || info.height > 2048 || !fs.existsSync(destination)) {
      throw new Error("Hasil pengolahan foto tidak valid.");
    }
    return { filename, ...info };
  } catch (error) {
    fs.rmSync(destination, { force: true });
    const e = error as { stderr?: string; code?: string };
    let detail: { error: string; code: string } | undefined;
    try { detail = JSON.parse(e.stderr?.trim() ?? ""); } catch { /* Python/native error */ }
    throw new PhotoProcessingError(detail?.error ?? "Pengolahan foto gagal. Periksa Python, Pillow, dan batas waktu proses.", detail?.code ?? "PROCESSING_FAILED");
  } finally {
    fs.rmSync(specFile, { force: true });
  }
}
