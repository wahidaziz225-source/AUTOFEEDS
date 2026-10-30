import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getJob, startAnalysis } from "@/lib/analysis";

function idFrom(req: Request): number {
  return Number(new URL(req.url).searchParams.get("image_id"));
}

// Cek status + hasil terbaru: GET /api/analyze?image_id=5
export async function GET(req: Request) {
  const id = idFrom(req);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  }
  const job = getJob(id);
  const analysis = getDb()
    .prepare(
      `SELECT id, description, objects, dominant_colors, visible_text, context, model, duration_ms, created_at
       FROM image_analysis WHERE image_id = ? ORDER BY id DESC LIMIT 1`
    )
    .get(id);
  return NextResponse.json({
    job: job
      ? { status: job.status, error: job.error, elapsed_ms: Date.now() - job.startedAt }
      : null,
    analysis: analysis ?? null,
  });
}

// Mulai analisis: POST /api/analyze?image_id=5
export async function POST(req: Request) {
  const id = idFrom(req);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  }
  const exists = getDb().prepare("SELECT id FROM images WHERE id = ?").get(id);
  if (!exists) {
    return NextResponse.json({ error: "Gambar tidak ditemukan." }, { status: 404 });
  }
  if (!startAnalysis(id)) {
    return NextResponse.json(
      { error: "Masih ada analisis yang berjalan. Tunggu sampai selesai." },
      { status: 409 }
    );
  }
  return NextResponse.json({ started: true }, { status: 202 });
}