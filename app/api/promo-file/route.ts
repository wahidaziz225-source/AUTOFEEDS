import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { promoPng } from "@/lib/promo-png";
import { promoPath, PROMO_DIR } from "@/lib/promo";

// /api/promo-file?id=5  (tambah &download=1 untuk mengunduh, &preview=1 untuk thumbnail cepat)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return new Response("ID tidak valid", { status: 400 });

  const row = getDb()
    .prepare("SELECT output_filename, preview_filename, title FROM promo_designs WHERE id = ?")
    .get(id) as { output_filename: string; preview_filename: string | null; title: string } | undefined;
  if (!row) return new Response("Tidak ditemukan", { status: 404 });

  // Mode pratinjau: tampilkan thumbnail kecil yang sudah ada
  const wantPreview = url.searchParams.get("preview") === "1";
  if (wantPreview && row.preview_filename) {
    const prevPath = path.join(PROMO_DIR, row.preview_filename);
    if (fs.existsSync(prevPath)) {
      return new Response(new Uint8Array(await fs.promises.readFile(prevPath)), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "private, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
  }

  const format = url.searchParams.get("format") ?? "jpg";
  if (!["jpg", "png"].includes(format)) return new Response("Format tidak valid", { status: 400 });

  let p: string | null;
  try {
    p = row.output_filename.toLowerCase().endsWith(".png")
      ? promoPath(row.output_filename)
      : format === "png" ? await promoPng(row.output_filename) : promoPath(row.output_filename);
  } catch {
    return new Response("Ekspor PNG gagal. Periksa Python/Pillow.", { status: 500 });
  }
  if (!p || !fs.existsSync(p)) return new Response("File hilang", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": p?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };
  if (url.searchParams.get("download") === "1") {
    headers["Content-Disposition"] = `attachment; filename="promo-${id}.${p?.toLowerCase().endsWith(".png") ? "png" : format}"`;
  }
  return new Response(new Uint8Array(await fs.promises.readFile(p)), { headers });
}
