import { NextResponse } from "next/server";
import { getDb, getSetting, logActivity } from "@/lib/db";
import { ollamaGenerate } from "@/lib/ollama";
import { buildPrompt, cleanOutput, CONTENT_TYPES, isContentType, isTone } from "@/lib/content";

const g = globalThis as unknown as { __autofeedsGenBusy?: boolean };

const SELECT_COLS = `id, image_id, content_type, tone, content, is_edited, is_saved, created_at, updated_at`;

// Daftar konten: ?image_id=5  atau  ?saved=1
export async function GET(req: Request) {
  const url = new URL(req.url);
  const imageId = Number(url.searchParams.get("image_id"));
  const db = getDb();
  let rows;
  if (Number.isInteger(imageId) && imageId > 0) {
    rows = db
      .prepare(`SELECT ${SELECT_COLS} FROM generated_contents WHERE image_id = ? ORDER BY id DESC`)
      .all(imageId);
  } else if (url.searchParams.get("saved") === "1") {
    rows = db
      .prepare(`SELECT ${SELECT_COLS} FROM generated_contents WHERE is_saved = 1 ORDER BY id DESC`)
      .all();
  } else {
    return NextResponse.json({ error: "Parameter tidak valid." }, { status: 400 });
  }
  return NextResponse.json({ contents: rows });
}

// Buat konten: body { image_id, content_type, tone, extra }
export async function POST(req: Request) {
  if (g.__autofeedsGenBusy) {
    return NextResponse.json(
      { error: "Masih ada konten yang sedang dibuat. Tunggu sampai selesai." },
      { status: 409 }
    );
  }
  g.__autofeedsGenBusy = true;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const imageId = Number(body.image_id);
    const type = String(body.content_type ?? "");
    const tone = String(body.tone ?? "");
    const extra = String(body.extra ?? "").slice(0, 1000);

    if (!Number.isInteger(imageId) || imageId <= 0 || !isContentType(type) || !isTone(tone)) {
      return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
    }

    const db = getDb();
    const analysis = db
      .prepare(
        `SELECT id, description, objects, dominant_colors, visible_text, context
         FROM image_analysis WHERE image_id = ? ORDER BY id DESC LIMIT 1`
      )
      .get(imageId) as
      | {
          id: number;
          description: string | null;
          objects: string | null;
          dominant_colors: string | null;
          visible_text: string | null;
          context: string | null;
        }
      | undefined;
    if (!analysis) {
      return NextResponse.json(
        { error: "Gambar ini belum dianalisis. Jalankan analisis dulu." },
        { status: 400 }
      );
    }

    const prompt = buildPrompt({
      type,
      tone,
      description: analysis.description ?? "",
      objects: analysis.objects ?? "",
      colors: analysis.dominant_colors ?? "",
      visibleText: analysis.visible_text ?? "",
      context: analysis.context ?? "",
      extra,
    });

    const model = getSetting("text_model");
        const rawText = await ollamaGenerate({ model, prompt, temperature: 0.7 });
    const text = cleanOutput(rawText, extra);
    if (!text) {
      return NextResponse.json({ error: "AI tidak menghasilkan teks. Coba lagi." }, { status: 502 });
    }

    const result = db
      .prepare(
        `INSERT INTO generated_contents (image_id, analysis_id, content_type, tone, content, model)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(imageId, analysis.id, type, tone, text, model);
    const id = Number(result.lastInsertRowid);
    const label = CONTENT_TYPES.find((t) => t.id === type)?.label ?? type;
    logActivity("Buat konten", "content", id, `${label} (${tone})`);

    const row = db.prepare(`SELECT ${SELECT_COLS} FROM generated_contents WHERE id = ?`).get(id);
    return NextResponse.json({ content: row }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal membuat konten." },
      { status: 500 }
    );
  } finally {
    g.__autofeedsGenBusy = false;
  }
}

// Edit / simpan: body { id, content?, is_saved? }
export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    }
    const db = getDb();
    const row = db
      .prepare("SELECT content, is_saved FROM generated_contents WHERE id = ?")
      .get(id) as { content: string; is_saved: number } | undefined;
    if (!row) return NextResponse.json({ error: "Konten tidak ditemukan." }, { status: 404 });

    let content = row.content;
    let edited = false;
    if (typeof body.content === "string") {
      const c = body.content.trim().slice(0, 10000);
      if (!c) return NextResponse.json({ error: "Konten tidak boleh kosong." }, { status: 400 });
      if (c !== row.content) {
        content = c;
        edited = true;
      }
    }
    const saved = typeof body.is_saved === "boolean" ? (body.is_saved ? 1 : 0) : row.is_saved;

    db.prepare(
      `UPDATE generated_contents
       SET content = ?, is_saved = ?, is_edited = CASE WHEN ? THEN 1 ELSE is_edited END,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(content, saved, edited ? 1 : 0, id);

    if (edited) logActivity("Edit konten", "content", id, null);
    if (saved !== row.is_saved) {
      logActivity(saved ? "Simpan konten" : "Batal simpan konten", "content", id, null);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal menyimpan." },
      { status: 500 }
    );
  }
}

// Hapus: DELETE /api/content?id=5
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  }
  const db = getDb();
  const res = db.prepare("DELETE FROM generated_contents WHERE id = ?").run(id);
  if (res.changes === 0) {
    return NextResponse.json({ error: "Konten tidak ditemukan." }, { status: 404 });
  }
  logActivity("Hapus konten", "content", id, null);
  return NextResponse.json({ ok: true });
}