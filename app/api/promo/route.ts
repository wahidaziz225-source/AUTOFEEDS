import { NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { MAX_PROMO_ITEMS, PROMO_FORMATS, PROMO_THEMES } from "@/lib/promo-options";
import { composePromo, deletePromoFile } from "@/lib/promo";
import { resolveUploadPath } from "@/lib/storage";

const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function GET() {
  const rows = getDb()
    .prepare(
      "SELECT id, title, layout_format, theme, created_at FROM promo_designs ORDER BY id DESC LIMIT 50"
    )
    .all();
  return NextResponse.json({ designs: rows });
}

// Body: { title, subtitle, footer, badge, format, theme, items: [{ image_id, name, price, old_price }] }
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const format = clean(body.format, 20);
    const theme = clean(body.theme, 20);
    if (!PROMO_FORMATS.some((f) => f.id === format) || !PROMO_THEMES.some((t) => t.id === theme)) {
      return NextResponse.json({ error: "Format atau tema tidak valid." }, { status: 400 });
    }
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length < 1 || rawItems.length > MAX_PROMO_ITEMS) {
      return NextResponse.json(
        { error: `Pilih 1 sampai ${MAX_PROMO_ITEMS} produk.` },
        { status: 400 }
      );
    }

    const db = getDb();
    const items: { path: string; name: string; price: string; old_price: string }[] = [];
    for (const r of rawItems as Record<string, unknown>[]) {
      const id = Number(r.image_id);
      const row = db
        .prepare("SELECT name, stored_filename FROM images WHERE id = ?")
        .get(id) as { name: string; stored_filename: string } | undefined;
      if (!row) {
        return NextResponse.json({ error: "Ada gambar yang tidak ditemukan." }, { status: 404 });
      }
      const p = resolveUploadPath(row.stored_filename);
      const price = clean(r.price, 30);
      if (!p || !price) {
        return NextResponse.json({ error: "Setiap produk wajib punya harga." }, { status: 400 });
      }
      items.push({
        path: p,
        name: clean(r.name, 60) || row.name,
        price,
        old_price: clean(r.old_price, 30),
      });
    }

    const title = clean(body.title, 40);
    const filename = await composePromo({
      format,
      theme,
      title,
      subtitle: clean(body.subtitle, 80),
      footer: clean(body.footer, 80),
      badge: clean(body.badge, 16),
      items,
    });

    const result = db
      .prepare(
        `INSERT INTO promo_designs (title, layout_format, theme, items_json, output_filename)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        title || "Promo",
        format,
        theme,
        JSON.stringify(items.map((i) => ({ name: i.name, price: i.price, old_price: i.old_price }))),
        filename
      );
    const id = Number(result.lastInsertRowid);
    logActivity("Buat desain promo", "promo", id, `${items.length} produk`);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal membuat desain." },
      { status: 500 }
    );
  }
}

// DELETE /api/promo?id=5
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  }
  const db = getDb();
  const row = db
    .prepare("SELECT output_filename FROM promo_designs WHERE id = ?")
    .get(id) as { output_filename: string } | undefined;
  if (!row) return NextResponse.json({ error: "Desain tidak ditemukan." }, { status: 404 });
  deletePromoFile(row.output_filename);
  db.prepare("DELETE FROM promo_designs WHERE id = ?").run(id);
  logActivity("Hapus desain promo", "promo", id, null);
  return NextResponse.json({ ok: true });
}