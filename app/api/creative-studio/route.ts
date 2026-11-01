import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import {
  CREATIVE_STYLES,
  PRODUCT_CATEGORIES,
  CONTENT_FORMATS,
  runCreativeStudioPython
} from "@/lib/creative-studio";

export const maxDuration = 120; // Support generous timeout for multi-image batch generation

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode");

    const db = getDb();
    // Ensure table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS creative_studio_designs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id TEXT,
        title TEXT NOT NULL,
        mode TEXT NOT NULL,
        style_id TEXT NOT NULL,
        format_id TEXT NOT NULL,
        product_name TEXT,
        headline TEXT,
        price_normal TEXT,
        price_promo TEXT,
        image_path TEXT NOT NULL,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_creative_batch ON creative_studio_designs(batch_id);
    `);

    if (mode === "favorites") {
      const favorites = db
        .prepare("SELECT * FROM creative_studio_designs WHERE is_favorite = 1 ORDER BY id DESC LIMIT 50")
        .all();
      return NextResponse.json({ success: true, favorites });
    }

    const recent = db
      .prepare("SELECT * FROM creative_studio_designs ORDER BY id DESC LIMIT 30")
      .all();

    return NextResponse.json({
      success: true,
      styles: CREATIVE_STYLES,
      categories: PRODUCT_CATEGORIES,
      formats: CONTENT_FORMATS,
      recent
    });
  } catch (error: any) {
    console.error("[CreativeStudio GET Error]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let action = "generate_variations";
    let productImgPath = "";
    let styleId = "premium_ad";
    let formatId = "portrait";
    let categoryId = "general";
    let count = 8;
    let productName = "Produk Unggulan";
    let headline = "Promo Spesial Hari Ini";
    let description = "";
    let priceNormal = "";
    let pricePromo = "";
    let discountTag = "";
    let ctaText = "Beli Sekarang";
    let targetDesignId: number | null = null;
    let uspPoints: string[] = [];

    const uploadBaseDir = path.resolve(process.cwd(), "storage", "uploads");
    const outputBaseDir = path.resolve(process.cwd(), "storage", "creative_output");
    fs.mkdirSync(uploadBaseDir, { recursive: true });
    fs.mkdirSync(outputBaseDir, { recursive: true });

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      action = (formData.get("action") as string) || "generate_variations";
      styleId = (formData.get("style") as string) || styleId;
      formatId = (formData.get("format") as string) || formatId;
      categoryId = (formData.get("category") as string) || categoryId;
      count = Number(formData.get("count") || 8);
      productName = (formData.get("product_name") as string) || productName;
      headline = (formData.get("headline") as string) || headline;
      description = (formData.get("description") as string) || "";
      priceNormal = (formData.get("price_normal") as string) || "";
      pricePromo = (formData.get("price_promo") as string) || "";
      discountTag = (formData.get("discount_tag") as string) || "";
      ctaText = (formData.get("cta_text") as string) || ctaText;

      const uspRaw = formData.get("usp_points") as string;
      if (uspRaw) {
        try {
          uspPoints = JSON.parse(uspRaw);
        } catch {
          uspPoints = uspRaw.split("\n").map(s => s.trim()).filter(Boolean);
        }
      }

      // Check uploaded file
      const file = formData.get("image") as File | null;
      if (file && file.size > 0) {
        const ext = path.extname(file.name) || ".jpg";
        const fileId = crypto.randomUUID();
        const savedName = `upload_${fileId}${ext}`;
        const savedPath = path.join(uploadBaseDir, savedName);
        const arrayBuf = await file.arrayBuffer();
        await fs.promises.writeFile(savedPath, Buffer.from(arrayBuf));
        productImgPath = savedPath;
      } else {
        const existingPath = formData.get("image_path") as string;
        if (existingPath) {
          productImgPath = existingPath;
        }
      }
    } else {
      // JSON payload
      const body = await req.json();
      action = body.action || action;
      styleId = body.style || styleId;
      formatId = body.format || formatId;
      categoryId = body.category || categoryId;
      count = Number(body.count || 8);
      productName = body.product_name || productName;
      headline = body.headline || headline;
      description = body.description || "";
      priceNormal = body.price_normal || "";
      pricePromo = body.price_promo || "";
      discountTag = body.discount_tag || "";
      ctaText = body.cta_text || ctaText;
      productImgPath = body.image_path || "";
      targetDesignId = body.design_id ? Number(body.design_id) : null;
      uspPoints = body.usp_points || [];
    }

    const db = getDb();

    // Toggle favorite action
    if (action === "toggle_favorite") {
      if (!targetDesignId) {
        return NextResponse.json({ success: false, error: "design_id diperlukan" }, { status: 400 });
      }
      const existing = db
        .prepare("SELECT is_favorite FROM creative_studio_designs WHERE id = ?")
        .get(targetDesignId) as { is_favorite: number } | undefined;

      if (!existing) {
        return NextResponse.json({ success: false, error: "Desain tidak ditemukan" }, { status: 404 });
      }

      const nextFav = existing.is_favorite === 1 ? 0 : 1;
      db.prepare("UPDATE creative_studio_designs SET is_favorite = ? WHERE id = ?").run(nextFav, targetDesignId);
      return NextResponse.json({ success: true, is_favorite: nextFav });
    }

    // Require valid product image for rendering
    if (!productImgPath || !fs.existsSync(productImgPath)) {
      return NextResponse.json(
        { success: false, error: "Foto produk asli belum dipilih atau file tidak ditemukan." },
        { status: 400 }
      );
    }

    const batchId = crypto.randomUUID();
    const batchOutputDir = path.join(outputBaseDir, batchId);
    fs.mkdirSync(batchOutputDir, { recursive: true });

    // Mode: Generate Variations (6–12 designs)
    if (action === "generate_variations") {
      const sanitizedCount = Math.max(6, Math.min(12, count || 8));

      const pyRes = await runCreativeStudioPython({
        mode: "variations",
        product_image: productImgPath,
        output_dir: batchOutputDir,
        count: sanitizedCount,
        style: styleId,
        format: formatId,
        category: categoryId,
        product_name: productName,
        headline: headline,
        description: description,
        price_normal: priceNormal,
        price_promo: pricePromo,
        discount_tag: discountTag,
        cta_text: ctaText
      });

      const variants = (pyRes.variants || []).map((v: any) => {
        const relativeFilePath = path.relative(process.cwd(), v.filepath);
        const encodedFile = encodeURIComponent(relativeFilePath);
        const publicUrl = `/api/creative-studio/file?file=${encodedFile}`;
        const downloadUrl = `/api/creative-studio/file?file=${encodedFile}&download=1`;

        // Persist to database
        const insertStmt = db.prepare(`
          INSERT INTO creative_studio_designs (
            batch_id, title, mode, style_id, format_id, product_name, headline,
            price_normal, price_promo, image_path, metadata_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = insertStmt.run(
          batchId,
          `${productName} — ${v.style_name}`,
          "variation",
          v.style_id,
          formatId,
          productName,
          v.headline,
          priceNormal,
          pricePromo,
          relativeFilePath,
          JSON.stringify({ composition: v.composition, index: v.index })
        );

        return {
          id: result.lastInsertRowid,
          batch_id: batchId,
          index: v.index,
          style_id: v.style_id,
          style_name: v.style_name,
          composition: v.composition,
          headline: v.headline,
          format: formatId,
          filename: v.filename,
          url: publicUrl,
          download_url: downloadUrl
        };
      });

      return NextResponse.json({
        success: true,
        mode: "variations",
        batch_id: batchId,
        total: variants.length,
        variants
      });
    }

    // Mode: Generate Instagram Carousel (5 slides)
    if (action === "generate_carousel") {
      const pyRes = await runCreativeStudioPython({
        mode: "carousel",
        product_image: productImgPath,
        output_dir: batchOutputDir,
        style: styleId,
        format: formatId,
        product_name: productName,
        headline: headline,
        usp_points: uspPoints,
        price_normal: priceNormal,
        price_promo: pricePromo,
        discount_tag: discountTag,
        cta_text: ctaText
      });

      const slides = (pyRes.slides || []).map((s: any) => {
        const relativeFilePath = path.relative(process.cwd(), s.filepath);
        const encodedFile = encodeURIComponent(relativeFilePath);
        const publicUrl = `/api/creative-studio/file?file=${encodedFile}`;
        const downloadUrl = `/api/creative-studio/file?file=${encodedFile}&download=1`;

        const insertStmt = db.prepare(`
          INSERT INTO creative_studio_designs (
            batch_id, title, mode, style_id, format_id, product_name, headline,
            price_normal, price_promo, image_path, metadata_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = insertStmt.run(
          batchId,
          `${productName} — Carousel Slide ${s.slide}`,
          "carousel",
          styleId,
          formatId,
          productName,
          s.title,
          priceNormal,
          pricePromo,
          relativeFilePath,
          JSON.stringify({ slide: s.slide, badge: s.badge })
        );

        return {
          id: result.lastInsertRowid,
          batch_id: batchId,
          slide: s.slide,
          title: s.title,
          badge: s.badge,
          filename: s.filename,
          url: publicUrl,
          download_url: downloadUrl
        };
      });

      return NextResponse.json({
        success: true,
        mode: "carousel",
        batch_id: batchId,
        total_slides: slides.length,
        slides
      });
    }

    // Mode: Single High-Res Design
    const singleFilename = `design_${Date.now()}.jpg`;
    const singleOutPath = path.join(batchOutputDir, singleFilename);

    await runCreativeStudioPython({
      mode: "single",
      product_image: productImgPath,
      output: singleOutPath,
      style: styleId,
      format: formatId,
      product_name: productName,
      headline: headline,
      description: description,
      price_normal: priceNormal,
      price_promo: pricePromo,
      discount_tag: discountTag,
      cta_text: ctaText,
      usp_points: uspPoints
    });

    const relPath = path.relative(process.cwd(), singleOutPath);
    const enc = encodeURIComponent(relPath);
    const pubUrl = `/api/creative-studio/file?file=${enc}`;
    const dldUrl = `/api/creative-studio/file?file=${enc}&download=1`;

    const ins = db.prepare(`
      INSERT INTO creative_studio_designs (
        batch_id, title, mode, style_id, format_id, product_name, headline,
        price_normal, price_promo, image_path, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const row = ins.run(
      batchId,
      `${productName} — Single`,
      "single",
      styleId,
      formatId,
      productName,
      headline,
      priceNormal,
      pricePromo,
      relPath,
      JSON.stringify({ style: styleId, format: formatId })
    );

    return NextResponse.json({
      success: true,
      mode: "single",
      id: row.lastInsertRowid,
      url: pubUrl,
      download_url: dldUrl,
      filename: singleFilename
    });

  } catch (error: any) {
    console.error("[CreativeStudio POST Error]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses AI Creative Studio" },
      { status: 500 }
    );
  }
}
