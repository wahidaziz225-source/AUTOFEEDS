import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import {
  MAX_PROMO_ITEMS,
  PROMO_FORMATS,
  PROMO_STYLES,
  PROMO_THEMES,
  PROMO_TYPES,
  computeItem,
  formatRupiah,
  parseAmount,
  type PromoParams,
} from "@/lib/promo-options";
import { composePromo, deletePromoFile, type PromoSpec, type PromoSpecItem } from "@/lib/promo";
import { resolveUploadPath } from "@/lib/storage";

const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET() {
  const rows = getDb()
    .prepare(
      "SELECT id, title, layout_format, theme, created_at FROM promo_designs ORDER BY id DESC LIMIT 50"
    )
    .all();
  return NextResponse.json({ designs: rows });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const format = clean(body.format, 20);
    const theme = clean(body.theme, 20);
    const type = clean(body.promo_type, 20);
    const style = clean(body.style ?? "retail", 20);
    if (!PROMO_STYLES.some((s) => s.id === style)) return bad("Konsep desain tidak valid.");

    if (!PROMO_FORMATS.some((f) => f.id === format)) return bad("Ukuran tidak valid.");
    if (!PROMO_THEMES.some((t) => t.id === theme)) return bad("Tema tidak valid.");
    if (!PROMO_TYPES.some((t) => t.id === type)) return bad("Jenis promo tidak valid.");

    const params: PromoParams = {
      discountPercent: Math.round(Number(body.discount_percent)),
      discountAmount: parseAmount(String(body.discount_amount ?? "")) ?? 0,
      buyQty: Math.round(Number(body.buy_qty)),
      freeQty: Math.round(Number(body.free_qty)),
      bundlePrice: clean(body.bundle_price, 30),
    };

    if (type === "diskon_persen" && !(params.discountPercent >= 1 && params.discountPercent <= 90)) {
      return bad("Persen diskon harus antara 1 dan 90.");
    }
    if (type === "potongan_rp" && params.discountAmount <= 0) {
      return bad("Isi nominal potongan dalam rupiah.");
    }
    if (type === "beli_gratis") {
      const okQty = (n: number) => Number.isInteger(n) && n >= 1 && n <= 10;
      if (!okQty(params.buyQty) || !okQty(params.freeQty)) {
        return bad("Jumlah beli dan gratis harus antara 1 dan 10.");
      }
    }

    const rawItems = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
    if (rawItems.length < 1 || rawItems.length > MAX_PROMO_ITEMS) {
      return bad(`Pilih 1 sampai ${MAX_PROMO_ITEMS} produk.`);
    }
    if (type === "bundling" && rawItems.length < 2) {
      return bad("Paket bundling butuh minimal 2 produk.");
    }

    const db = getDb();
    const items: PromoSpecItem[] = [];
    const normals: (number | null)[] = [];

    for (const r of rawItems) {
      if (!r || typeof r !== "object" || !Number.isSafeInteger(Number(r.image_id)) || Number(r.image_id) <= 0) {
        return bad("Data produk tidak valid.");
      }
      const row = db
        .prepare("SELECT name, stored_filename FROM images WHERE id = ?")
        .get(Number(r.image_id)) as { name: string; stored_filename: string } | undefined;
      if (!row) return bad("Ada gambar yang tidak ditemukan.", 404);
      const p = resolveUploadPath(row.stored_filename);
      if (!p) return bad("File gambar tidak valid.");
      const name = clean(r.name, 60) || row.name;
      const price = clean(r.price, 30);
      const oldPrice = clean(r.old_price, 30);

      if (type === "bundling") {
        normals.push(parseAmount(price));
        items.push({ path: p, name, price_text: "", old_text: "", tag: "" });
      } else {
        const c = computeItem(type, params, price, oldPrice);
        if (!c.ok) return bad(`${name}: ${c.error}`);
        items.push({ path: p, name, price_text: c.priceText, old_text: c.oldText, tag: c.tag });
      }
    }

    let bundle: PromoSpec["bundle"];
    if (type === "bundling") {
      const bp = parseAmount(params.bundlePrice);
      if (!bp) return bad("Isi harga paket (angka).");
      const allKnown = normals.every((n) => n != null && n > 0);
      let oldText = "";
      let tag = "";
      if (allKnown) {
        const total = (normals as number[]).reduce((a, b) => a + b, 0);
        if (bp >= total) {
          return bad(`Harga paket harus lebih murah dari total harga normal (${formatRupiah(total)}).`);
        }
        oldText = formatRupiah(total);
        tag = `HEMAT ${formatRupiah(total - bp)}`;
      }
      bundle = { label: "PAKET HEMAT", price_text: formatRupiah(bp), old_text: oldText, tag };
    }

    const title = clean(body.title, 40);
    const seed = crypto.randomInt(1, 2_000_000_000);
    const spec: PromoSpec = {
      format,
      theme,
      seed,
      style,
      mode: type === "bundling" ? "bundle" : "items",
      title,
      subtitle: clean(body.subtitle, 80),
      footer: clean(body.footer, 80),
      badge: clean(body.badge, 16),
      items,
      bundle,
    };
    const filename = await composePromo(spec);

    const result = db
      .prepare(
        `INSERT INTO promo_designs (title, layout_format, theme, items_json, output_filename)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        title || "Promo",
        format,
        theme,
        JSON.stringify({
          promo_type: type,
          style,
          seed,
          items: items.map((i) => ({
            name: i.name,
            price: i.price_text,
            old: i.old_text,
            tag: i.tag,
          })),
          bundle,
        }),
        filename
      );
    const id = Number(result.lastInsertRowid);
    logActivity("Buat desain promo", "promo", id, `${type}, ${items.length} produk`);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Gagal membuat desain.", 500);
  }
}

// DELETE /api/promo?id=5
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return bad("ID tidak valid.");
  const db = getDb();
  const row = db
    .prepare("SELECT output_filename FROM promo_designs WHERE id = ?")
    .get(id) as { output_filename: string } | undefined;
  if (!row) return bad("Desain tidak ditemukan.", 404);
  deletePromoFile(row.output_filename);
  db.prepare("DELETE FROM promo_designs WHERE id = ?").run(id);
  logActivity("Hapus desain promo", "promo", id, null);
  return NextResponse.json({ ok: true });
}