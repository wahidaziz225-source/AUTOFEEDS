import fs from "node:fs";
import { getDb } from "@/lib/db";
import { processedPath } from "@/lib/image-processing";
import { resolveUploadPath } from "@/lib/storage";

// Menampilkan gambar: /api/image-file?id=5
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return new Response("ID tidak valid", { status: 400 });
  }

  const row = getDb()
    .prepare("SELECT stored_filename, mime_type FROM images WHERE id = ?")
    .get(id) as { stored_filename: string; mime_type: string } | undefined;
  if (!row) return new Response("Tidak ditemukan", { status: 404 });

  const variantId = url.searchParams.get("variant_id");
  let filePath = resolveUploadPath(row.stored_filename);
  let mime = row.mime_type;
  if (variantId !== null) {
    const variantNumber = Number(variantId);
    if (!Number.isSafeInteger(variantNumber) || variantNumber <= 0) return new Response("ID varian tidak valid", { status: 400 });
    const variant = getDb().prepare("SELECT stored_filename FROM image_variants WHERE id = ? AND image_id = ?")
      .get(variantNumber, id) as { stored_filename: string } | undefined;
    if (!variant) return new Response("Varian tidak ditemukan", { status: 404 });
    filePath = processedPath(variant.stored_filename);
    mime = "image/png";
  }
  if (!filePath || !fs.existsSync(filePath)) {
    return new Response("File hilang", { status: 404 });
  }

  const data = fs.readFileSync(filePath);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ...(url.searchParams.get("download") === "1" ? { "Content-Disposition": `attachment; filename="foto-${id}${variantId ? `-varian-${Number(variantId)}` : ""}.${mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg"}"` } : {}),
    },
  });
}