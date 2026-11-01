import fs from "node:fs";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getDb, getSetting, logActivity } from "@/lib/db";
import { composePromo, type PromoSpec, type PromoSpecItem } from "@/lib/promo";
import { resolveUploadPath } from "@/lib/storage";
import { processedPath } from "@/lib/image-processing";
import { computeItem, formatRupiah, parseAmount, PROMO_THEMES, type PromoParams } from "@/lib/promo-options";
import { ollamaGenerate } from "@/lib/ollama";

const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

function generateFallbackCaption(opts: {
  name: string;
  promoType: string;
  priceText: string;
  oldText?: string;
  tag?: string;
  benefits?: string;
  footer?: string;
  buyQty?: number;
  freeQty?: number;
  freeName?: string;
}): string {
  const { name, promoType, priceText, oldText, tag, benefits, footer, buyQty, freeQty, freeName } = opts;

  let hook = "🔥 PROMO SPESIAL HARI INI! 🔥";
  let offer = `Dapatkan ${name} sekarang dengan harga spesial cuma ${priceText}!`;

  if (promoType === "diskon_persen") {
    hook = "⚡ DISKON SPESIAL TERBATAS! ⚡";
    offer = `Hemat banget! ${name} diskon ${tag ?? "spesial"}, dari ${oldText || "harga normal"} sekarang cuma ${priceText}!`;
  } else if (promoType === "beli_gratis") {
    hook = "🎁 PROMO BELI GRATIS SPESIAL! 🎁";
    offer = `Beli ${buyQty || 1} ${name}, langsung GRATIS ${freeQty || 1} ${freeName || "produk pilihan"}! Jangan sampai kelewatan!`;
  } else if (oldText) {
    offer = `Dari ${oldText}, sekarang cuma ${priceText}! Hemat maksimal untuk kualitas terbaik.`;
  }

  const benefitLines = benefits
    ? `\n✨ Kenapa harus punya sekarang?\n${benefits
        .split("\n")
        .map((b) => (b.trim().startsWith("•") || b.trim().startsWith("-") ? b.trim() : `• ${b.trim()}`))
        .join("\n")}\n`
    : "";

  const cta = footer || "Pesan sekarang sebelum kehabisan! Stok sangat terbatas.";
  const tags = "#promospesial #diskonhariini #belanjahemat #promoonline #flashsale #indonesia #belanja #viral #kuliner #onlineshop";

  return `${hook}

${offer}
${benefitLines}
📦 Kualitas terjamin & siap kirim cepat!
👉 ${cta}

${tags}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") return bad("Permintaan tidak valid.");

    const db = getDb();
    const imageId = Number(body.image_id);
    if (!Number.isSafeInteger(imageId) || imageId <= 0) return bad("Pilih produk terlebih dahulu.");

    const row = db
      .prepare("SELECT name, stored_filename FROM images WHERE id = ?")
      .get(imageId) as { name: string; stored_filename: string } | undefined;
    if (!row) return bad("Foto produk tidak ditemukan.", 404);

    let p = resolveUploadPath(row.stored_filename);
    if (body.variant_id !== undefined && body.variant_id !== null) {
      const vId = Number(body.variant_id);
      if (Number.isSafeInteger(vId) && vId > 0) {
        const variant = db
          .prepare("SELECT stored_filename FROM image_variants WHERE id = ? AND image_id = ?")
          .get(vId, imageId) as { stored_filename: string } | undefined;
        if (variant) p = processedPath(variant.stored_filename);
      }
    }
    if (!p || !fs.existsSync(p)) return bad("File foto produk tidak ditemukan.", 404);

    const name = clean(body.name, 60) || row.name;
    const promoType = clean(body.promo_type ?? "harga_spesial", 20);
    const price = clean(body.price, 30);
    const oldPrice = clean(body.old_price, 30);
    const format = clean(body.format ?? "feed", 20);
    const theme = clean(body.theme ?? "midnight", 20);
    const title = clean(body.title ?? "PROMO SPESIAL", 40);
    const subtitle = clean(body.subtitle, 80);
    const footer = clean(body.footer, 80);
    const badge = clean(body.badge ?? "PROMO", 16);
    const benefits = clean(body.benefits, 500);

    const params: PromoParams = {
      discountPercent: Math.round(Number(body.discount_percent ?? 20)),
      discountAmount: parseAmount(String(body.discount_amount ?? "")) ?? 0,
      buyQty: Math.max(1, Math.round(Number(body.buy_qty ?? 1))),
      freeQty: Math.max(1, Math.round(Number(body.free_qty ?? 1))),
      bundlePrice: clean(body.bundle_price, 30),
    };

    let freeItemSpec: PromoSpecItem | null = null;
    let freeName = "";
    if (promoType === "beli_gratis" && body.free_product && typeof body.free_product === "object") {
      const fp = body.free_product as Record<string, unknown>;
      const freeImgId = Number(fp.image_id);
      if (Number.isSafeInteger(freeImgId) && freeImgId > 0) {
        const freeRow = db
          .prepare("SELECT name, stored_filename FROM images WHERE id = ?")
          .get(freeImgId) as { name: string; stored_filename: string } | undefined;
        if (freeRow) {
          let freePath = resolveUploadPath(freeRow.stored_filename);
          if (fp.variant_id) {
            const vRow = db
              .prepare("SELECT stored_filename FROM image_variants WHERE id = ? AND image_id = ?")
              .get(Number(fp.variant_id), freeImgId) as { stored_filename: string } | undefined;
            if (vRow) freePath = processedPath(vRow.stored_filename);
          }
          if (freePath && fs.existsSync(freePath)) {
            freeName = clean(fp.name, 60) || freeRow.name;
            freeItemSpec = {
              image_id: freeImgId,
              variant_id: fp.variant_id ? Number(fp.variant_id) : null,
              path: freePath,
              name: freeName,
              price_text: "GRATIS",
              old_text: "",
              tag: `GRATIS ${params.freeQty}`,
            };
          }
        }
      }
    }

    const c = computeItem(promoType, params, price, oldPrice);
    if (!c.ok) return bad(c.error);

    const mainTag = freeItemSpec ? `BELI ${params.buyQty}` : c.tag;
    const items: PromoSpecItem[] = [
      {
        image_id: imageId,
        variant_id: body.variant_id ? Number(body.variant_id) : null,
        path: p,
        name,
        price_text: c.priceText,
        old_text: c.oldText,
        tag: mainTag,
      },
    ];

    if (freeItemSpec) {
      items.push(freeItemSpec);
    }

    // 1. Generate Promo Poster
    const seed = crypto.randomInt(1, 2_000_000_000);
    const spec: PromoSpec = {
      format,
      theme,
      seed,
      style: "retail",
      mode: "items",
      title,
      subtitle,
      footer,
      badge,
      items,
    };

    const outFilename = await composePromo(spec);

    // Save into promo_designs
    const meta = {
      promo_type: promoType,
      style: "retail",
      seed,
      items: items.map((i) => ({
        image_id: i.image_id,
        variant_id: i.variant_id,
        name: i.name,
        price: i.price_text,
        old: i.old_text,
        tag: i.tag,
      })),
    };
    const designRes = db
      .prepare("INSERT INTO promo_designs (title, layout_format, theme, items_json, output_filename) VALUES (?, ?, ?, ?, ?)")
      .run(title || "Promo", format, theme, JSON.stringify(meta), outFilename);
    const designId = Number(designRes.lastInsertRowid);

    // Save generation metadata
    const batchId = crypto.randomUUID();
    db.prepare("INSERT INTO promo_generation (design_id, batch_id, request_json, style, seed, is_saved) VALUES (?, ?, ?, ?, ?, 1)")
      .run(designId, batchId, JSON.stringify(body), "retail", seed);

    logActivity("Buat Feeds Express", "promo", designId, `${title}; ${theme}`);

    // 2. Generate Instagram Caption
    let captionText = "";
    try {
      const textModel = getSetting("text_model");
      const prompt = `Kamu adalah copywriter media sosial profesional untuk brand e-commerce.
Tulis 1 caption Instagram yang sangat menarik, persuasif, dan siap di-upload untuk promo produk berikut:
- Nama Produk: ${name}
- Jenis Promo: ${promoType}
- Harga Promo: ${c.priceText}
- Harga Normal: ${c.oldText || "normal"}
- Badge / Diskon: ${c.tag || "-"}
${benefits ? `- Keunggulan / Manfaat Utama: ${benefits}` : ""}
${freeItemSpec ? `- Bonus Gratis: ${freeItemSpec.name}` : ""}
${footer ? `- Info / Ajakan bertindak: ${footer}` : ""}

Aturan:
1. Mulai dengan hook kalimat pembuka yang eye-catching dan emoji yang relevan.
2. Jelaskan penawaran dengan jelas dan keuntungan membeli sekarang.
3. Beri Call to Action (ajakan memesan/menghubungi) di akhir.
4. Tambahkan 6-8 hashtag yang relevan di baris terakhir.
5. Tulis langsung caption siap pakai tanpa kalimat pengantar "Berikut adalah...".`;

      const aiText = await Promise.race([
        ollamaGenerate({ model: textModel, prompt, temperature: 0.7 }),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error("timeout")), 6000)),
      ]);

      if (aiText && aiText.trim().length > 20) {
        captionText = aiText.trim();
      }
    } catch {
      // Ollama not available or timed out -> fallback to high-converting copywriting template
    }

    if (!captionText) {
      captionText = generateFallbackCaption({
        name,
        promoType,
        priceText: c.priceText,
        oldText: c.oldText,
        tag: c.tag,
        benefits,
        footer,
        buyQty: params.buyQty,
        freeQty: params.freeQty,
        freeName,
      });
    }

    // Save into generated_contents
    let contentId: number | null = null;
    try {
      const cRes = db
        .prepare("INSERT INTO generated_contents (image_id, content_type, tone, content, model, is_saved) VALUES (?, ?, ?, ?, ?, 1)")
        .run(imageId, "caption_instagram", "promosi", captionText, "express-auto");
      contentId = Number(cRes.lastInsertRowid);
    } catch {
      // silent
    }

    return NextResponse.json({
      ok: true,
      design: {
        id: designId,
        title,
        format,
        theme,
        image_url: `/api/promo-file?id=${designId}`,
        download_url: `/api/promo-file?id=${designId}&download=1`,
      },
      caption: {
        id: contentId,
        text: captionText,
      },
    });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Gagal memproses Auto Feeds Express.", 500);
  }
}
