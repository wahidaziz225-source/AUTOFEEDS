import { getSetting } from "./db";
import { ollamaTimeoutMs } from "./ollama";
import fs from "node:fs";
import path from "node:path";

export async function generateOpenAiBackground(options: {
  headline: string;
  format: string;
  mood: string;
  recipe: string;
  instructions?: string;
  revision?: string;
  referenceImagePath?: string | null;
}): Promise<Buffer> {
  const apiKey = getSetting("openai_api_key");
  if (!apiKey) throw new Error("OpenAI API key belum diatur. Buka Pengaturan AI untuk memasukkannya.");
  const model = getSetting("openai_image_model") || "gpt-image-2.5-flare";
  const ratio = options.format === "story" ? "9:16" : options.format === "square" ? "1:1" : "4:5";
  const prompt = `${options.referenceImagePath ? "Use the uploaded finished poster strictly as a visual style and composition reference. Borrow its palette, lighting, decorative motifs, and overall art direction; do not copy its words, logo, or depicted product." : "Create an original visual direction."} ` +
    `Create only a beautiful, photorealistic advertising background/stage for an Indonesian product poster. Portrait aspect ratio ${ratio}. ` +
    `Product category or campaign context: ${options.headline}. Mood: ${options.mood}. Layout direction: ${options.recipe}. ` +
    `User direction: ${options.instructions || "none"}. Revision: ${options.revision || "none"}. ` +
    `Create layered studio lighting, elegant material textures and polished commercial art direction. Leave clean negative space for later typography and product placement. ` +
    `Do not draw any product, package, bottle, food item, person, logo, letters, words, numbers, price, badge, or watermark. Background only.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ollamaTimeoutMs());
  let response: Response;
  try {
    const headers = { Authorization: `Bearer ${apiKey}` };
    if (options.referenceImagePath) {
      const ext = path.extname(options.referenceImagePath).toLowerCase();
      const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      const form = new FormData();
      form.set("model", model);
      form.set("prompt", prompt);
      form.set("size", "1024x1536");
      form.set("quality", "medium");
      form.set("output_format", "png");
      const bytes = await fs.promises.readFile(options.referenceImagePath);
      form.set("image", new Blob([new Uint8Array(bytes)], { type: mime }), `style-reference${ext}`);
      response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST", headers, body: form, signal: controller.signal,
      });
    } else {
      response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, n: 1, size: "1024x1536", quality: "medium", output_format: "png" }),
        signal: controller.signal,
      });
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("OpenAI Image terlalu lama membuat latar poster (timeout).");
    throw new Error("Tidak dapat terhubung ke OpenAI API. Periksa koneksi internet.");
  } finally {
    clearTimeout(timer);
  }
  const payload = await response.json().catch(() => ({})) as { data?: { b64_json?: string }[]; error?: { message?: string } };
  if (!response.ok) throw new Error(`OpenAI Image gagal: ${(payload.error?.message || `HTTP ${response.status}`).slice(0, 260)}`);
  const data = payload.data?.[0]?.b64_json;
  if (!data) throw new Error("OpenAI tidak mengembalikan gambar latar.");
  return Buffer.from(data, "base64");
}

export async function generateOpenAiPoster(options: {
  productImagePath: string;
  styleReferencePath?: string | null;
  headline: string;
  tagline?: string;
  benefits?: string[];
  price?: string;
  oldPrice?: string;
  format: string;
  mood?: string;
  recipe?: string;
  instructions?: string;
  revision?: string;
}): Promise<Buffer> {
  const apiKey = getSetting("openai_api_key");
  if (!apiKey) throw new Error("OpenAI API key belum diatur. Buka Pengaturan AI.");
  if (!fs.existsSync(options.productImagePath)) throw new Error("Foto produk tidak ditemukan.");
  const model = getSetting("openai_image_model") || "gpt-image-2.5-sunburst";
  const ratio = options.format === "story" ? "9:16" : options.format === "square" ? "1:1" : "4:5";
  const prompt = `Create one finished, premium Indonesian social media promotional poster, portrait ${ratio}. ` +
    `This is a complete designed poster, not a background or mockup. Use the first image as the real product package: preserve its exact silhouette, colors, brand, label and logo; make the package the clear hero. ` +
    (options.styleReferencePath ? `Use the second image only as a design reference for art direction, palette, lighting, and layout rhythm. Never copy its product, brand, or text. ` : "Create an original art direction. ") +
    `Design direction: ${options.recipe || "a refined product hero composition"}; mood: ${options.mood || "premium and inviting"}. ` +
    `Use strong visual hierarchy, professional typography, generous spacing, restrained graphic accents, high contrast, polished studio lighting, and safe margins. Avoid clutter, overlapping elements, sticker piles, excessive badges, fake text, and watermarks. ` +
    `Render only the following supplied copy, accurately and without adding claims: headline “${options.headline}”; tagline “${options.tagline || "(omit)"}”; ` +
    `current price “${options.price || "(omit)"}”; previous price “${options.oldPrice || "(omit)"}”; benefits ${(options.benefits || []).length ? options.benefits!.map((value) => `“${value}”`).join(", ") : "(omit)"}. ` +
    `User direction: ${options.instructions || "none"}. Requested revision: ${options.revision || "none"}. ` +
    `Do not invent any price, discount, benefit, logo, or wording. Do not alter the product packaging. Return the poster artwork only.`;

  const form = new FormData();
  form.set("model", model);
  form.set("prompt", prompt);
  form.set("size", options.format === "square" ? "1024x1024" : "1024x1536");
  form.set("quality", "high");
  form.set("output_format", "png");
  const inputPaths = [options.productImagePath, options.styleReferencePath]
    .filter((file): file is string => Boolean(file && fs.existsSync(file)))
    .slice(0, 4);
  for (const file of inputPaths) {
    const ext = path.extname(file).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    const bytes = await fs.promises.readFile(file);
    form.append("image[]", new Blob([new Uint8Array(bytes)], { type: mime }), path.basename(file));
  }

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(ollamaTimeoutMs()),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw new Error("OpenAI Image terlalu lama membuat poster (timeout).");
    throw new Error("Tidak dapat terhubung ke OpenAI API. Periksa koneksi internet.");
  }
  const payload = await response.json().catch(() => ({})) as { data?: { b64_json?: string }[]; error?: { message?: string } };
  if (!response.ok) throw new Error(`OpenAI Image gagal: ${(payload.error?.message || `HTTP ${response.status}`).slice(0, 260)}`);
  const data = payload.data?.[0]?.b64_json;
  if (!data) throw new Error("OpenAI tidak mengembalikan poster.");
  return Buffer.from(data, "base64");
}
