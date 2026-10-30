import { NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import {
  deleteImageFile,
  sanitizeDisplayName,
  saveImage,
  validateImage,
} from "@/lib/storage";
import { deleteAiCopy, processImage } from "@/lib/image-tools";

// Daftar semua gambar
export async function GET() {
  const rows = getDb()
    .prepare(
      `SELECT i.id, i.name, i.original_filename, i.mime_type, i.size_bytes,
              i.width, i.height, i.category_id, c.name AS category_name, i.created_at
       FROM images i
       LEFT JOIN categories c ON c.id = i.category_id
       ORDER BY i.id DESC`
    )
    .all();
  return NextResponse.json({ images: rows });
}

// Unggah satu gambar (form-data: file, name, category_id)
export async function POST(req: Request) {
  let stored: string | null = null;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const check = validateImage(buf);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const db = getDb();
    const name = sanitizeDisplayName(String(form.get("name") ?? "").trim() || file.name);

    let categoryId: number | null = null;
    const catRaw = String(form.get("category_id") ?? "");
    if (catRaw) {
      const n = Number(catRaw);
      if (Number.isInteger(n) && db.prepare("SELECT id FROM categories WHERE id = ?").get(n)) {
        categoryId = n;
      }
    }

    const saved = saveImage(buf);
    stored = saved.storedFilename;
    const info = await processImage(stored);

    const result = db
      .prepare(
        `INSERT INTO images
           (name, original_filename, stored_filename, mime_type, size_bytes, width, height, category_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        name,
        sanitizeDisplayName(file.name),
        stored,
        saved.mime,
        saved.sizeBytes,
        info.width,
        info.height,
        categoryId
      );

    const id = Number(result.lastInsertRowid);
    logActivity("Upload gambar", "image", id, name);
    return NextResponse.json({ id, name, warning: info.warning }, { status: 201 });
  } catch (e) {
    if (stored) {
      deleteImageFile(stored);
      deleteAiCopy(stored);
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Terjadi kesalahan saat menyimpan." },
      { status: 500 }
    );
  }
}

// Hapus gambar: DELETE /api/images?id=5
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  }

  const db = getDb();
  const row = db
    .prepare("SELECT name, stored_filename FROM images WHERE id = ?")
    .get(id) as { name: string; stored_filename: string } | undefined;
  if (!row) {
    return NextResponse.json({ error: "Gambar tidak ditemukan." }, { status: 404 });
  }

  try {
    deleteImageFile(row.stored_filename);
    deleteAiCopy(row.stored_filename);
    db.prepare("DELETE FROM images WHERE id = ?").run(id);
    logActivity("Hapus gambar", "image", id, row.name);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal menghapus." },
      { status: 500 }
    );
  }
}