import fs from "node:fs";
import { getDb } from "@/lib/db";
import { resolveUploadPath } from "@/lib/storage";

// Menampilkan gambar: /api/image-file?id=5
export async function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return new Response("ID tidak valid", { status: 400 });
  }

  const row = getDb()
    .prepare("SELECT stored_filename, mime_type FROM images WHERE id = ?")
    .get(id) as { stored_filename: string; mime_type: string } | undefined;
  if (!row) return new Response("Tidak ditemukan", { status: 404 });

  const filePath = resolveUploadPath(row.stored_filename);
  if (!filePath || !fs.existsSync(filePath)) {
    return new Response("File hilang", { status: 404 });
  }

  const data = fs.readFileSync(filePath);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": row.mime_type,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}