import fs from "node:fs";
import { validateCanvasSize } from "@/lib/design-document";
import { selectedBrand, rendererBrand } from "@/lib/brands";
import { validateBrandSnapshot, type BrandSnapshot } from "@/lib/brand-options";
import { createPromoBatch, nextVariationStyle, variationCount, variationStyles } from "@/lib/promo-variations";
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
import { processedPath } from "@/lib/image-processing";
import { resolveUploadPath } from "@/lib/storage";

const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

const g = globalThis as unknown as { __promoGenerationBusy?: boolean };
const SELECT = `SELECT p.id, p.title, p.layout_format, p.theme, p.created_at,
  m.batch_id, m.style, COALESCE(m.is_saved, 0) AS is_saved,
  CASE WHEN m.request_json IS NOT NULL AND m.request_json != '' THEN 1 ELSE 0 END AS can_regenerate
  FROM promo_designs p LEFT JOIN promo_generation m ON m.design_id = p.id`;

export async function GET(req: Request) {
  const query = new URL(req.url).searchParams;
  const batch = query.get("batch_id");
  const rows = batch
    ? getDb().prepare(`${SELECT} WHERE m.batch_id = ? ORDER BY p.id LIMIT 6`).all(batch)
    : getDb().prepare(`${SELECT} ${query.get("saved") === "1" ? "WHERE m.is_saved = 1" : ""} ORDER BY p.id DESC LIMIT 100`).all();
  return NextResponse.json({ designs: rows, generating: Boolean(g.__promoGenerationBusy) });
}

export async function POST(req: Request) {
  if (g.__promoGenerationBusy) return bad("Masih ada desain yang dibuat. Tunggu sampai selesai.", 409);
  g.__promoGenerationBusy = true;
  try {
    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return bad("Permintaan tidak valid.");
      body = parsed;
    } catch { return bad("JSON tidak valid."); }
    let count: number;
    try { count = variationCount(body.count); } catch (e) { return bad((e as Error).message); }
    const isRegenerate = body.regenerate_id !== undefined;
    const isMore = body.source_id !== undefined;
    let frozenBrand: BrandSnapshot | null = null;
    let parentId: number | null = null;
    let layoutVariant = crypto.randomInt(0, 2);
    if (isRegenerate && isMore) return bad("Pilih satu tindakan pembuatan variasi.");
    if (isRegenerate || isMore) {
      parentId = Number(body.regenerate_id ?? body.source_id);
      if (!Number.isSafeInteger(parentId) || parentId <= 0) return bad("ID desain tidak valid.");
      const source = getDb().prepare(`SELECT m.request_json, m.style, m.layout_variant FROM promo_designs p
        LEFT JOIN promo_generation m ON m.design_id = p.id WHERE p.id = ?`).get(parentId) as
        { request_json: string | null; style: string | null; layout_variant: number | null } | undefined;
      if (!source) return bad("Desain tidak ditemukan.", 404);
      if (!source.request_json) return bad("Desain lama belum menyimpan pengaturan. Buat desain baru dari formulir terlebih dahulu.", 409);
      body = JSON.parse(source.request_json) as Record<string, unknown>;
      frozenBrand = validateBrandSnapshot(body.brand_snapshot);
      layoutVariant = source.layout_variant === 1 ? 0 : 1;
      body.style = nextVariationStyle(source.style ?? "retail");
      if (isRegenerate) count = 1;
      else if (count === 1) return bad("Variasi tambahan harus berjumlah 4, 5, atau 6.");
    }
    let brand: BrandSnapshot | null;
    try { brand = isRegenerate || isMore ? frozenBrand : selectedBrand(body.brand_kit_id); } catch(e) { return bad((e as Error).message); }
    const format = clean(body.format ?? brand?.promo_format, 20);
    const theme = clean(body.theme, 20);
    const type = clean(body.promo_type, 20);
    const style = clean(body.style ?? brand?.promo_style ?? "retail", 20);
    if (!PROMO_STYLES.some((s) => s.id === style)) return bad("Konsep desain tidak valid.");

    if (!PROMO_FORMATS.some((f) => f.id === format)) return bad("Ukuran tidak valid.");
    if (!PROMO_THEMES.some((t) => t.id === theme)) return bad("Tema tidak valid.");
    if (!PROMO_TYPES.some((t) => t.id === type)) return bad("Jenis promo tidak valid.");

    let customSize: {width:number;height:number}|undefined;
    if(format==="custom"){try{customSize=validateCanvasSize(body.width,body.height);}catch(e){return bad((e as Error).message);}}

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
      let p = resolveUploadPath(row.stored_filename);
      if (r.variant_id !== undefined && r.variant_id !== null) {
        const variantId = Number(r.variant_id);
        if (!Number.isSafeInteger(variantId) || variantId <= 0) return bad("ID varian foto tidak valid.");
        const variant = db.prepare("SELECT stored_filename FROM image_variants WHERE id = ? AND image_id = ?")
          .get(variantId, Number(r.image_id)) as { stored_filename: string } | undefined;
        if (!variant) return bad("Varian foto tidak ditemukan untuk produk ini.", 404);
        p = processedPath(variant.stored_filename);
      }
      if (!p || !fs.existsSync(p)) return bad("File foto sumber tidak ditemukan. Pilih foto atau varian yang masih tersedia.", 404);
      const name = clean(r.name, 60) || row.name;
      const price = clean(r.price, 30);
      const oldPrice = clean(r.old_price, 30);

      const sourceIds = { image_id: Number(r.image_id), variant_id: r.variant_id == null ? null : Number(r.variant_id) };
      if (type === "bundling") {
        normals.push(parseAmount(price));
        items.push({ ...sourceIds, path: p, name, price_text: "", old_text: "", tag: "" });
      } else {
        const c = computeItem(type, params, price, oldPrice);
        if (!c.ok) return bad(`${name}: ${c.error}`);
        items.push({ ...sourceIds, path: p, name, price_text: c.priceText, old_text: c.oldText, tag: c.tag });
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

    const title = clean(body.title ?? brand?.promo_title, 40);
    const seed = crypto.randomInt(1, 2_000_000_000);
    const spec: PromoSpec = {
      ...customSize,
      format,
      theme,
      seed,
      style,
      mode: type === "bundling" ? "bundle" : "items",
      title,
      subtitle: clean(body.subtitle, 80),
      footer: clean(body.footer ?? brand?.footer_text, 80),
      brand: rendererBrand(brand),
      badge: clean(body.badge ?? brand?.promo_badge, 16),
      items,
      bundle,
    };
    const styles = variationStyles(style, count, crypto.randomInt(0, 5));
    const request = {
      ...customSize, brand_snapshot: brand, format, theme, promo_type: type, title, subtitle: spec.subtitle, footer: spec.footer, badge: spec.badge,
      discount_percent: params.discountPercent, discount_amount: params.discountAmount,
      buy_qty: params.buyQty, free_qty: params.freeQty, bundle_price: params.bundlePrice,
      items: rawItems.map((r, index) => ({ image_id: Number(r.image_id), variant_id: r.variant_id == null ? null : Number(r.variant_id),
        name: items[index].name, price: clean(r.price, 30), old_price: clean(r.old_price, 30) })),
    };
    const batchId = crypto.randomUUID();
    const specs = styles.map((concept, index) => ({ ...spec, style: concept, layout_variant: layoutVariant,
      seed: (seed + index) % 2_000_000_000 }));
    const designs = await createPromoBatch(count, index => composePromo(specs[index]), files => db.transaction(() => {
      const ids: number[] = [];
      for (let index = 0; index < files.length; index++) {
        const current = specs[index];
        const meta = { brand_snapshot: brand, promo_type: type, style: current.style, seed: current.seed, layout_variant: layoutVariant,
          items: items.map(i => ({ image_id: i.image_id, variant_id: i.variant_id, name: i.name, price: i.price_text, old: i.old_text, tag: i.tag })), bundle };
        const result = db.prepare(`INSERT INTO promo_designs (title, layout_format, theme, items_json, output_filename) VALUES (?, ?, ?, ?, ?)`)
          .run(title || "Promo", format, theme, JSON.stringify(meta), files[index]);
        const id = Number(result.lastInsertRowid);
        db.prepare(`INSERT INTO promo_generation (design_id, batch_id, request_json, style, seed, layout_variant, parent_design_id) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(id, batchId, JSON.stringify({ ...request, style: current.style }), current.style, current.seed, layoutVariant, parentId);
        ids.push(id);
        logActivity(isRegenerate ? "Buat ulang desain promo" : "Buat desain promo", "promo", id, `${current.style}; batch ${batchId}`);
      }
      return ids.map(id => db.prepare(`${SELECT} WHERE p.id = ?`).get(id));
    })(), deletePromoFile);
    return NextResponse.json({ id: (designs[0] as { id: number }).id, batch_id: batchId, designs }, { status: 201 });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Gagal membuat desain.", 500);
  } finally {
    g.__promoGenerationBusy = false;
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") return bad("Permintaan tidak valid.");
    const id = Number(body.id);
    if (!Number.isSafeInteger(id) || id <= 0 || typeof body.is_saved !== "boolean") return bad("Status simpan tidak valid.");
    const db = getDb();
    if (!db.prepare("SELECT id FROM promo_designs WHERE id = ?").get(id)) return bad("Desain tidak ditemukan.", 404);
    db.transaction(() => {
      // Legacy JPGs can be bookmarked without inventing regeneration settings.
      db.prepare(`INSERT INTO promo_generation (design_id, batch_id, request_json, style, seed, is_saved)
        VALUES (?, ?, '', '', 0, ?) ON CONFLICT(design_id) DO UPDATE SET is_saved = excluded.is_saved`)
        .run(id, crypto.randomUUID(), body.is_saved ? 1 : 0);
      logActivity(body.is_saved ? "Simpan desain pilihan" : "Lepas desain pilihan", "promo", id, null);
    })();
    return NextResponse.json({ ok: true });
  } catch { return bad("Permintaan simpan tidak valid."); }
}

// DELETE /api/promo?id=5
export async function DELETE(req: Request) {
  if (g.__promoGenerationBusy) return bad("Tunggu proses pembuatan desain selesai sebelum menghapus.", 409);
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