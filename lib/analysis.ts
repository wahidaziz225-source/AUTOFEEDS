import fs from "node:fs";
import path from "node:path";
import { getDb, getSetting, logActivity } from "./db";
import { generateAI } from "./ollama";
import { AI_DIR, aiFilenameFor } from "./image-tools";
import { UPLOAD_DIR } from "./storage";

export type JobState = {
  imageId: number;
  status: "running" | "done" | "error";
  startedAt: number;
  error?: string;
};

// Status proses disimpan di memori server (hilang bila server restart, hasil tetap di database)
const g = globalThis as unknown as { __autofeedsJobs?: Map<number, JobState> };
const jobs: Map<number, JobState> = (g.__autofeedsJobs ??= new Map());

export function getJob(imageId: number): JobState | undefined {
  return jobs.get(imageId);
}

const PROMPT = `Kamu adalah analis gambar produk. Perhatikan gambar dengan teliti lalu jawab HANYA dalam format JSON dengan kunci berikut, ditulis dalam Bahasa Indonesia:
{
  "description": "deskripsi singkat dan faktual tentang isi gambar (2-4 kalimat)",
  "objects": ["objek atau produk yang benar-benar terlihat"],
  "dominant_colors": ["warna dominan"],
  "visible_text": ["teks yang terbaca jelas pada gambar, tulis persis; kosongkan jika tidak ada"],
  "context": "konteks atau suasana gambar (misalnya toko, katalog, makanan, outdoor)"
}
Aturan penting:
- Jangan mengarang nama merek, harga, ukuran, atau informasi lain yang tidak terlihat jelas pada gambar.
- Jika teks tidak terbaca jelas, jangan ditebak; biarkan daftar visible_text kosong.
- Jangan menambahkan penjelasan di luar JSON.`;

function asText(v: unknown): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map(String).filter(Boolean).join(", ") || null;
  const s = String(v).trim();
  return s || null;
}

function parseJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function runAnalysis(imageId: number): Promise<void> {
  const db = getDb();
  const row = db
    .prepare("SELECT name, stored_filename FROM images WHERE id = ?")
    .get(imageId) as { name: string; stored_filename: string } | undefined;
  if (!row) throw new Error("Gambar tidak ditemukan.");

  // Pakai versi kecil jika ada, jika tidak pakai gambar asli
  let file = path.join(AI_DIR, aiFilenameFor(row.stored_filename));
  if (!fs.existsSync(file)) file = path.join(UPLOAD_DIR, row.stored_filename);
  if (!fs.existsSync(file)) throw new Error("File gambar tidak ditemukan di penyimpanan.");

  const model = getSetting("ai_provider") === "gemini" ? getSetting("gemini_vision_model") : getSetting("vision_model");
  const b64 = fs.readFileSync(file).toString("base64");
  const ext = path.extname(file).toLowerCase();
  const imageMimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "image/jpeg";
  const t0 = Date.now();
  const raw = await generateAI({ model, prompt: PROMPT, images: [b64], imageMimeType, json: true });
  const duration = Date.now() - t0;

  const parsed = parseJson(raw);
  const description = parsed ? asText(parsed.description) : raw;

  const result = db
    .prepare(
      `INSERT INTO image_analysis
        (image_id, description, objects, dominant_colors, visible_text, context, raw_response, model, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      imageId,
      description,
      parsed ? asText(parsed.objects) : null,
      parsed ? asText(parsed.dominant_colors) : null,
      parsed ? asText(parsed.visible_text) : null,
      parsed ? asText(parsed.context) : null,
      raw,
      model,
      duration
    );
  logActivity("Analisis gambar", "image", imageId, `${row.name} (${Math.round(duration / 1000)} dtk)`);
  void result;
}

// Mulai analisis di latar belakang. Mengembalikan false jika sudah berjalan.
export function startAnalysis(imageId: number): boolean {
  const existing = jobs.get(imageId);
  if (existing?.status === "running") return false;
  // Satu analisis sekaligus agar CPU tidak kewalahan
  for (const j of jobs.values()) if (j.status === "running") return false;

  const job: JobState = { imageId, status: "running", startedAt: Date.now() };
  jobs.set(imageId, job);
  runAnalysis(imageId)
    .then(() => {
      job.status = "done";
    })
    .catch((e) => {
      job.status = "error";
      job.error = e instanceof Error ? e.message : String(e);
    });
  return true;
}
