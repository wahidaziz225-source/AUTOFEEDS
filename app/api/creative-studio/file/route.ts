import fs from "node:fs";
import path from "node:path";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const filePathParam = url.searchParams.get("file");

  if (!filePathParam) {
    return new Response("Parameter file diperlukan", { status: 400 });
  }

  // Sanitize path to prevent directory traversal
  const normalizedPath = path.normalize(filePathParam);
  const creativeDir = path.resolve(process.cwd(), "storage", "creative_output");
  const fullPath = path.isAbsolute(normalizedPath)
    ? normalizedPath
    : path.resolve(process.cwd(), normalizedPath);

  // Allow files within storage/creative_output or storage/uploads
  const allowedRoots = [
    path.resolve(process.cwd(), "storage", "creative_output"),
    path.resolve(process.cwd(), "storage", "uploads"),
    path.resolve(process.cwd(), "public", "uploads")
  ];

  const isAllowed = allowedRoots.some(root => fullPath.startsWith(root));
  if (!isAllowed) {
    return new Response("Akses file tidak diizinkan", { status: 403 });
  }

  if (!fs.existsSync(fullPath)) {
    return new Response("File tidak ditemukan", { status: 404 });
  }

  const stat = await fs.promises.stat(fullPath);
  const etag = `"${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}"`;

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304 });
  }

  const ext = path.extname(fullPath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const download = url.searchParams.get("download") === "1";
  const filename = path.basename(fullPath);

  const headers: Record<string, string> = {
    "Content-Type": mime,
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "ETag": etag,
    "X-Content-Type-Options": "nosniff"
  };

  if (download) {
    headers["Content-Disposition"] = `attachment; filename="${filename}"`;
  }

  const data = await fs.promises.readFile(fullPath);
  return new Response(new Uint8Array(data), { headers });
}
