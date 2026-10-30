import { NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";

const FIELDS = ["description", "objects", "dominant_colors", "visible_text", "context"] as const;

// Edit hasil analisis: PATCH /api/analysis  body: { id, description, objects, ... }
export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    }
    const db = getDb();
    const row = db
      .prepare("SELECT image_id FROM image_analysis WHERE id = ?")
      .get(id) as { image_id: number } | undefined;
    if (!row) {
      return NextResponse.json({ error: "Analisis tidak ditemukan." }, { status: 404 });
    }
    const values = FIELDS.map((f) => String(body[f] ?? "").trim().slice(0, 2000) || null);
    db.prepare(
      `UPDATE image_analysis
       SET description = ?, objects = ?, dominant_colors = ?, visible_text = ?, context = ?
       WHERE id = ?`
    ).run(...values, id);
    logActivity("Edit analisis", "image", row.image_id, null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal menyimpan." },
      { status: 500 }
    );
  }
}