import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { AI_DIR, aiFilenameFor } from "@/lib/image-tools";
import { processedPath } from "@/lib/image-processing";
import { resolveUploadPath } from "@/lib/storage";

// /api/image-file?id=5              -> foto asli
// /api/image-file?id=5&size=small   -> versi kecil (maks. 1024 px) untuk thumbnail
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
    if (!Number.isSafeInteger(variantNumber) || variantNumber <= 0) {
      return new Response("ID varian tidak valid", { status: 400 });
    }
    const variant = getDb()
      .prepare("SELECT stored_filename FROM image_variants WHERE id = ? AND image_id = ?")
      .get(variantNumber, id) as { stored_filename: string } | undefined;
    if (!variant) return new Response("Varian tidak ditemukan", { status: 404 });
    filePath = processedPath(variant.stored_filename);
    mime = "image/png";
  } else if (url.searchParams.get("size") === "small") {
    const small = path.join(AI_DIR, aiFilenameFor(row.stored_filename));
    if (fs.existsSync(small)) {
      filePath = small;
      mime = "image/jpeg";
    }
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return new Response("File hilang", { status: 404 });
  }

  const data = await fs.promises.readFile(filePath);
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ...(url.searchParams.get("download") === "1"
        ? {
            "Content-Disposition": `attachment; filename="foto-${id}${
              variantId ? `-varian-${Number(variantId)}` : ""
            }.${ext}"`,
          }
        : {}),
    },
  });
}