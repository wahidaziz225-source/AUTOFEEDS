import fs from "node:fs";
import { getDb } from "@/lib/db";
import { promoPath } from "@/lib/promo";

// /api/promo-file?id=5  (tambah &download=1 untuk mengunduh)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return new Response("ID tidak valid", { status: 400 });

  const row = getDb()
    .prepare("SELECT output_filename, title FROM promo_designs WHERE id = ?")
    .get(id) as { output_filename: string; title: string } | undefined;
  if (!row) return new Response("Tidak ditemukan", { status: 404 });

  const p = promoPath(row.output_filename);
  if (!p || !fs.existsSync(p)) return new Response("File hilang", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": "image/jpeg",
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };
  if (url.searchParams.get("download") === "1") {
    headers["Content-Disposition"] = `attachment; filename="promo-${id}.jpg"`;
  }
  return new Response(new Uint8Array(fs.readFileSync(p)), { headers });
}