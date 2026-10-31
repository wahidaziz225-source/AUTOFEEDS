import fs from "node:fs";
import { NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { resolveUploadPath } from "@/lib/storage";
import { validateImageOptions } from "@/lib/image-processing-options";
import {
  photoCapabilities, beginPhotoProcessing, finishPhotoProcessing,
  createProcessedPhoto, deleteProcessedFile, PhotoProcessingError,
} from "@/lib/image-processing";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const positiveId = (n: number) => Number.isSafeInteger(n) && n > 0;

export async function GET(req: Request) {
  const query = new URL(req.url).searchParams;
  if (query.get("capabilities") === "1") return NextResponse.json({ capabilities: await photoCapabilities() });
  const id = Number(query.get("image_id"));
  if (!positiveId(id)) return bad("ID gambar tidak valid.");
  const db = getDb();
  if (!db.prepare("SELECT id FROM images WHERE id = ?").get(id)) return bad("Gambar tidak ditemukan.", 404);
  const variants = db.prepare("SELECT id, image_id, width, height, options_json, engine, created_at FROM image_variants WHERE image_id = ? ORDER BY id DESC").all(id);
  return NextResponse.json({ variants });
}

export async function POST(req: Request) {
  let started = false;
  let filename: string | undefined;
  let persisted = false;
  try {
    let body;
    try { body = await req.json(); } catch { return bad("JSON tidak valid."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return bad("Permintaan tidak valid.");
    const imageId = Number(body.image_id);
    if (!positiveId(imageId)) return bad("ID gambar tidak valid.");
    let options;
    try { options = validateImageOptions(body.options); } catch (e) { return bad((e as Error).message); }
    const db = getDb();
    const row = db.prepare("SELECT stored_filename FROM images WHERE id = ?").get(imageId) as { stored_filename: string } | undefined;
    if (!row) return bad("Gambar tidak ditemukan.", 404);
    const source = resolveUploadPath(row.stored_filename);
    if (!source || !fs.existsSync(source)) return bad("Foto asli tidak ditemukan.", 404);
    if (!beginPhotoProcessing(imageId)) return bad("Masih ada foto yang diproses. Tunggu sampai selesai.", 409);
    started = true;
    const output = await createProcessedPhoto(source, options);
    filename = output.filename;
    const variant = db.transaction(() => {
      const result = db.prepare(`INSERT INTO image_variants (image_id, stored_filename, width, height, options_json, engine) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(imageId, output.filename, output.width, output.height, JSON.stringify(options), output.engine);
      const id = Number(result.lastInsertRowid);
      logActivity("Olah foto produk", "image", imageId, `${output.engine}; varian ${id}`);
      return db.prepare("SELECT id, image_id, width, height, options_json, engine, created_at FROM image_variants WHERE id = ?").get(id);
    })();
    persisted = true;
    return NextResponse.json({ variant }, { status: 201 });
  } catch (e) {
    if (filename && !persisted) deleteProcessedFile(filename);
    if (e instanceof PhotoProcessingError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === "BACKGROUND_UNAVAILABLE" ? 409 : e.code === "PROCESSING_FAILED" || e.code === "MODEL_FAILED" ? 500 : 400 });
    }
    return bad("Gagal menyimpan hasil pengolahan foto.", 500);
  } finally {
    if (started) finishPhotoProcessing();
  }
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!positiveId(id)) return bad("ID varian tidak valid.");
  const db = getDb();
  const row = db.prepare("SELECT image_id, stored_filename FROM image_variants WHERE id = ?").get(id) as { image_id: number; stored_filename: string } | undefined;
  if (!row) return bad("Varian tidak ditemukan.", 404);
  try {
    deleteProcessedFile(row.stored_filename);
    db.transaction(() => {
      db.prepare("DELETE FROM image_variants WHERE id = ?").run(id);
      logActivity("Hapus varian foto", "image", row.image_id, `Varian ${id}`);
    })();
    return NextResponse.json({ ok: true });
  } catch { return bad("Varian gagal dihapus.", 500); }
}
