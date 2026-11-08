import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getSetting } from "./db";
import { ollamaTimeoutMs } from "./ollama";

const execFileAsync = promisify(execFile);

export async function generateCloudflareBackground(options: {
  headline: string;
  format: string;
  mood: string;
  recipe: string;
  instructions?: string;
  revision?: string;
  referenceImagePath?: string | null;
}): Promise<Buffer> {
  const accountId = getSetting("cloudflare_account_id");
  const token = getSetting("cloudflare_api_token");
  if (!accountId || !token) throw new Error("Cloudflare Account ID dan API token belum diatur. Buka Pengaturan AI.");
  const model = getSetting("cloudflare_image_model") || "@cf/black-forest-labs/flux-2-klein-4b";
  const ratio = options.format === "story" ? "9:16" : options.format === "square" ? "1:1" : "4:5";
  const prompt = `${options.referenceImagePath ? "Use reference image 0 only for its visual style: borrow palette, lighting, decorative motifs and broad composition. Do not copy its text, logo, brand, or depicted product." : "Create a fresh art direction."} ` +
    `Create only a polished, photorealistic advertising background for an Indonesian product poster, portrait aspect ratio ${ratio}. ` +
    `Campaign context: ${options.headline}. Mood: ${options.mood}. Layout direction: ${options.recipe}. ` +
    `Additional direction: ${options.instructions || "none"}. Revision: ${options.revision || "none"}. ` +
    `Use attractive studio lighting, refined textures, rich depth, clean negative space for separate product and typography layers. ` +
    `Do not draw products, packages, people, logos, words, letters, numbers, prices, badges, or watermarks. Background only.`;

  const tempDir = options.referenceImagePath ? fs.mkdtempSync(path.join(os.tmpdir(), "autofeeds-cf-")) : null;
  const referencePath = tempDir ? path.join(tempDir, "reference.jpg") : null;
  try {
    if (options.referenceImagePath && referencePath) {
      await execFileAsync(process.env.AUTOFEEDS_PYTHON || "python", [
        path.join(process.cwd(), "scripts", "resize_image.py"), options.referenceImagePath, referencePath, "500",
      ], { timeout: 30_000, windowsHide: true });
    }

    const form = new FormData();
    form.set("prompt", prompt);
    form.set("width", "1024");
    form.set("height", options.format === "story" ? "1792" : options.format === "square" ? "1024" : "1280");
    if (referencePath) {
      const bytes = await fs.promises.readFile(referencePath);
      form.set("input_image_0", new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), "style-reference.jpg");
    }

    let response: Response;
    try {
      // Model IDs are namespaced paths (for example @cf/vendor/model); keep
      // the slashes as path separators instead of URL-encoding the whole ID.
      response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        signal: AbortSignal.timeout(ollamaTimeoutMs()),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") throw new Error("Cloudflare FLUX terlalu lama membuat latar poster (timeout).");
      throw new Error("Tidak dapat terhubung ke Cloudflare Workers AI. Periksa koneksi internet.");
    }
    const payload = await response.json().catch(() => ({})) as {
      result?: { image?: string };
      errors?: { message?: string }[];
      success?: boolean;
    };
    if (!response.ok || payload.success === false) {
      const message = payload.errors?.map((item) => item.message).filter(Boolean).join("; ") || `HTTP ${response.status}`;
      if (response.status === 401 || response.status === 403) throw new Error("Cloudflare menolak token. Periksa token Workers AI dan izin akunnya.");
      throw new Error(`Cloudflare FLUX gagal: ${message.slice(0, 260)}`);
    }
    if (!payload.result?.image) throw new Error("Cloudflare FLUX tidak mengembalikan gambar.");
    return Buffer.from(payload.result.image, "base64");
  } finally {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
