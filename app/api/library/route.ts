import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isContentType } from "@/lib/content";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/library?q=...&category_id=...&type=...&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    const where: string[] = ["gc.is_saved = 1"];
    const args: (string | number)[] = [];

    const q = (p.get("q") ?? "").trim().slice(0, 100);
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, (m) => "\\" + m)}%`;
      where.push("(gc.content LIKE ? ESCAPE '\\' OR i.name LIKE ? ESCAPE '\\')");
      args.push(like, like);
    }

    const cat = p.get("category_id");
    if (cat === "0") {
      where.push("COALESCE(gc.category_id, i.category_id) IS NULL");
    } else if (cat && Number.isInteger(Number(cat)) && Number(cat) > 0) {
      where.push("COALESCE(gc.category_id, i.category_id) = ?");
      args.push(Number(cat));
    }

    const type = p.get("type") ?? "";
    if (type && isContentType(type)) {
      where.push("gc.content_type = ?");
      args.push(type);
    }

    const from = p.get("from") ?? "";
    if (DATE_RE.test(from)) {
      where.push("date(gc.created_at) >= date(?)");
      args.push(from);
    }
    const to = p.get("to") ?? "";
    if (DATE_RE.test(to)) {
      where.push("date(gc.created_at) <= date(?)");
      args.push(to);
    }

    const rows = getDb()
      .prepare(
        `SELECT gc.id, gc.image_id, gc.content_type, gc.tone, gc.content,
                gc.is_edited, gc.created_at, gc.updated_at,
                i.name AS image_name,
                c.name AS category_name,
                a.description, a.objects, a.dominant_colors, a.visible_text, a.context
         FROM generated_contents gc
         JOIN images i ON i.id = gc.image_id
         LEFT JOIN categories c ON c.id = COALESCE(gc.category_id, i.category_id)
         LEFT JOIN image_analysis a ON a.id = gc.analysis_id
         WHERE ${where.join(" AND ")}
         ORDER BY gc.id DESC
         LIMIT 200`
      )
      .all(...args);

    return NextResponse.json({ items: rows });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal memuat Library." },
      { status: 500 }
    );
  }
}