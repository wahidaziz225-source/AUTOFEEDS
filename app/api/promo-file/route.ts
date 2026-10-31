import fs from "node:fs";
import { getDb } from "@/lib/db";
import { promoPng } from "@/lib/promo-png";
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

  const format=url.searchParams.get("format")??"jpg";
  if(!["jpg","png"].includes(format))return new Response("Format tidak valid",{status:400});
  let p:string|null;
  try{p=format==="png"?await promoPng(row.output_filename):promoPath(row.output_filename);}catch{return new Response("Ekspor PNG gagal. Periksa Python/Pillow.",{status:500});}
  if (!p || !fs.existsSync(p)) return new Response("File hilang", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": format==="png"?"image/png":"image/jpeg",
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };
  if (url.searchParams.get("download") === "1") {
    headers["Content-Disposition"] = `attachment; filename="promo-${id}.${format}"`;
  }
  return new Response(new Uint8Array(fs.readFileSync(p)), { headers });
}