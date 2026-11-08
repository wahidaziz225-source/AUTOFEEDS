import fs from "node:fs";
import path from "node:path";
import { getSetting } from "./db";
import { ollamaTimeoutMs } from "./ollama";

type PosterOptions = {
  model?: string;
  imagePaths: (string | null | undefined)[];
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
  styleReferencePath?: string | null;
};

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
};

export async function generateGeminiPoster(options: PosterOptions): Promise<Buffer> {
  const apiKey = getSetting("gemini_api_key");
  if (!apiKey) throw new Error("Gemini API key belum diatur. Buka Pengaturan AI untuk memasukkannya.");
  const model = options.model || getSetting("gemini_image_model") || "gemini-2.5-flash-image";
  const ratio = options.format === "story" ? "9:16" : options.format === "square" ? "1:1" : "4:5";
  const prompt = `Create one polished Indonesian social media product advertising poster. Aspect ratio ${ratio}.\n` +
    `Use the first supplied photo as the exact product reference: preserve its package, logo, label, colors, and shape faithfully. If a second reference poster is supplied, borrow its visual style and composition only; do not copy its product, wording, or logo.\n` +
    `Poster headline (render exactly, keep spelling): ${options.headline}\n` +
    `Tagline (render exactly if present): ${options.tagline || "none"}\n` +
    `Price (render exactly if present): ${options.price || "none"}\n` +
    `Previous price (render exactly if present): ${options.oldPrice || "none"}\n` +
    `Benefits (only these factual claims, render exactly if present): ${(options.benefits || []).join("; ") || "none"}\n` +
    `Visual direction: ${options.recipe || "professional product hero"}; mood: ${options.mood || "warm"}.\n` +
    `Additional user direction: ${options.instructions || "none"}\n` +
    `Requested revision: ${options.revision || "none"}\n` +
    `Design a refined, high contrast, premium commercial layout with strong hierarchy, attractive lighting, clean typography, legible Indonesian text and safe margins. Do not add unprovided claims, prices, discounts, logos, or extra words. Return the poster image.`;

  const parts: Record<string, unknown>[] = [];
  const orderedImages = [options.imagePaths[0], options.styleReferencePath, ...options.imagePaths.slice(1)];
  for (const file of orderedImages.filter((p): p is string => Boolean(p && fs.existsSync(p))).slice(0, 3)) {
    parts.push({ inline_data: { mime_type: MIME[path.extname(file).toLowerCase()] || "image/jpeg", data: fs.readFileSync(file).toString("base64") } });
  }
  if (!parts.length) throw new Error("Foto produk tidak ditemukan untuk dikirim ke Gemini.");
  parts.push({ text: prompt });

  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["Image"] } }),
      signal: AbortSignal.timeout(ollamaTimeoutMs()),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw new Error("Gemini Image terlalu lama membuat poster (timeout).");
    throw new Error("Tidak dapat terhubung ke Gemini API. Periksa koneksi internet.");
  }
  const payload = await response.json().catch(() => ({})) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } }[] } }[];
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(`Gemini Image gagal: ${(payload.error?.message || `HTTP ${response.status}`).slice(0, 240)}`);
  for (const part of payload.candidates?.[0]?.content?.parts ?? []) {
    const data = part.inlineData?.data ?? part.inline_data?.data;
    if (data) return Buffer.from(data, "base64");
  }
  throw new Error("Gemini tidak mengembalikan gambar. Periksa nama model pembuat poster di Pengaturan AI.");
}
