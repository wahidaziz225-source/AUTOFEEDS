/**
 * Scene Composer API – POST /api/express/scene-compose
 * Memanggil scene_composer.py untuk menghasilkan poster studio-grade.
 * Mendukung 3 variasi sekaligus (parallel via ThreadPoolExecutor di sisi Python).
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getDb, getSetting, logActivity } from "@/lib/db";
import { resolveUploadPath, UPLOAD_DIR, validateImage } from "@/lib/storage";
import { generateAI } from "@/lib/ollama";
import { generateGeminiPoster } from "@/lib/gemini-image";
import { generateOpenAiPoster } from "@/lib/openai-image";
import { generateCloudflareBackground } from "@/lib/cloudflare-image";

const execFileAsync = promisify(execFile);

const PROMO_DIR = path.join(UPLOAD_DIR, "promo");
const SCENE_SCRIPT = path.join(process.cwd(), "scripts", "scene_composer.py");
const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

// Resep Scene Composer yang tersedia
const RECIPES = [
  "hero_left_target",
  "hero_center_burst",
  "split_diagonal",
  "flatlay_overhead",
  "price_star",
  "minimal_luxury",
] as const;

const FORMATS = ["feed", "square", "story"] as const;
const MOODS = ["warm", "dark", "bright", "luxury", "natural", "bold"] as const;
const GOALS = ["diskon", "beli_gratis", "bundling", "produk_baru", "info"] as const;

type Recipe = (typeof RECIPES)[number];

async function runComposer(spec: Record<string, unknown>, outPath: string, previewPath: string): Promise<Record<string, unknown>> {
  fs.mkdirSync(PROMO_DIR, { recursive: true });
  const specFile = path.join(PROMO_DIR, `.sc-spec-${crypto.randomUUID()}.json`);
  fs.writeFileSync(specFile, JSON.stringify(spec), "utf-8");
  try {
    const { stdout } = await execFileAsync(
      "python",
      [SCENE_SCRIPT, specFile, outPath, "--preview", previewPath],
      { timeout: 120_000, windowsHide: true }
    );
    return JSON.parse(stdout.trim() || "{}");
  } finally {
    if (fs.existsSync(specFile)) fs.unlinkSync(specFile);
  }
}

function generateCaption(opts: {
  headline: string;
  tagline: string;
  benefits: string[];
  price?: string;
  oldPrice?: string;
  goal: string;
  brandName?: string;
}): string {
  const { headline, tagline, benefits, price, oldPrice, goal, brandName } = opts;

  const emojiMap: Record<string, string> = {
    diskon: "⚡",
    beli_gratis: "🎁",
    bundling: "📦",
    produk_baru: "🆕",
    info: "📣",
  };
  const emoji = emojiMap[goal] ?? "🔥";

  const hookMap: Record<string, string> = {
    diskon: `${emoji} DISKON SPESIAL! Jangan Sampai Kelewatan!`,
    beli_gratis: `${emoji} PROMO BELI GRATIS! Stok Terbatas!`,
    bundling: `${emoji} BUNDLING HEMAT! Paket Terbaik Hari Ini!`,
    produk_baru: `${emoji} PRODUK BARU HADIR! Segera Coba!`,
    info: `${emoji} INFORMASI PENTING! Simak Sekarang!`,
  };
  const hook = hookMap[goal] ?? `${emoji} PROMO SPESIAL HARI INI!`;

  const priceBlock = price
    ? oldPrice
      ? `\n💰 Dari ~~${oldPrice}~~ sekarang hanya ${price}!`
      : `\n💰 Harga spesial: ${price}`
    : "";

  const benefitLines = benefits.filter(Boolean).map((b) => `✅ ${b}`).join("\n");
  const brandLine = brandName ? `\n\n— ${brandName} —` : "";
  const tags =
    "#promospesial #produk #hariini #belanja #hemat #kuliner #indonesia #viral #instafood #onlineshop";

  return `${hook}

✨ ${headline}
${tagline ? `💬 ${tagline}` : ""}${priceBlock}

${benefitLines ? `🌟 Mengapa Pilih Kami?\n${benefitLines}\n` : ""}📲 Segera hubungi kami atau klik link di bio!
${brandLine}

${tags}`;
}

export async function POST(req: Request) {
  let referencePosterPath: string | null = null;
  try {
    let body: Record<string, unknown>;
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await req.formData();
      const payload = form.get("payload");
      if (typeof payload !== "string") return bad("Data form poster tidak ditemukan.");
      body = JSON.parse(payload) as Record<string, unknown>;
      const reference = form.get("reference_poster");
      if (reference instanceof File && reference.size > 0) {
        const bytes = Buffer.from(await reference.arrayBuffer());
        const check = validateImage(bytes);
        if (!check.ok) return bad(`Poster referensi: ${check.error}`);
        fs.mkdirSync(PROMO_DIR, { recursive: true });
        referencePosterPath = path.join(PROMO_DIR, `.style-ref-${crypto.randomUUID()}${check.type.ext}`);
        fs.writeFileSync(referencePosterPath, bytes, { flag: "wx" });
      }
    } else {
      body = await req.json() as Record<string, unknown>;
    }
    if (!body || typeof body !== "object") return bad("Permintaan tidak valid.");

    const db = getDb();

    // --- Resolusi foto produk utama ---
    const imageId = Number(body.image_id);
    if (!Number.isSafeInteger(imageId) || imageId <= 0) return bad("Pilih foto produk terlebih dahulu.");

    const row = db
      .prepare("SELECT name, stored_filename FROM images WHERE id = ?")
      .get(imageId) as { name: string; stored_filename: string } | undefined;
    if (!row) return bad("Foto produk tidak ditemukan.", 404);

    const productPath = resolveUploadPath(row.stored_filename);
    if (!productPath || !fs.existsSync(productPath)) return bad("File foto produk tidak ditemukan.", 404);

    // --- Foto pendukung (opsional) ---
    const dishImageId = Number(body.dish_image_id) || null;
    const textureImageId = Number(body.texture_image_id) || null;

    function resolveOptional(imgId: number | null): string | null {
      if (!imgId || !Number.isSafeInteger(imgId)) return null;
      const r = db.prepare("SELECT stored_filename FROM images WHERE id = ?").get(imgId) as { stored_filename: string } | undefined;
      if (!r) return null;
      const p = resolveUploadPath(r.stored_filename);
      return p && fs.existsSync(p) ? p : null;
    }

    const dishPath = resolveOptional(dishImageId);
    const texturePath = resolveOptional(textureImageId);

    // --- Parameter desain ---
    const headline = clean(body.headline ?? (body.title ?? row.name), 60);
    const tagline = clean(body.tagline ?? "", 80);
    const format = String(body.format ?? "feed");
    if (!FORMATS.includes(format as (typeof FORMATS)[number])) return bad("Ukuran poster tidak valid.");
    const recipe = String(body.recipe ?? "hero_left_target");
    if (!RECIPES.includes(recipe as Recipe)) return bad("Gaya poster tidak valid.");
    const mood = String(body.mood ?? "warm");
    if (!MOODS.includes(mood as (typeof MOODS)[number])) return bad("Tema warna tidak valid.");
    const benefits = Array.isArray(body.benefits)
      ? (body.benefits as unknown[]).slice(0, 3).map((b) => clean(b, 60))
      : clean(body.benefits ?? "", 200).split("\n").filter(Boolean).slice(0, 3);

    const price = clean(body.price ?? "", 30);
    const oldPrice = clean(body.old_price ?? "", 30);
    const goal = String(body.goal ?? "diskon");
    if (!GOALS.includes(goal as (typeof GOALS)[number])) return bad("Tujuan promosi tidak valid.");
    const discountTag = clean(body.discount_tag ?? "", 20);
    const brandName = clean(body.brand_name ?? "", 60);
    const freeInstructions = clean(body.instructions ?? "", 200);

    // Ambil Brand Kit dari settings / tabel brand_kits
    let brand: Record<string, unknown> | null = null;
    try {
      const bk = db.prepare("SELECT * FROM brand_kits WHERE is_active = 1 LIMIT 1").get() as Record<string, unknown> | undefined;
      if (bk) brand = bk;
    } catch { /* tabel mungkin belum ada */ }

    // Tentukan resep yang akan dirender
    const requestedRecipes: Recipe[] = [];
    if (Array.isArray(body.recipes)) {
      (body.recipes as unknown[]).forEach((r) => {
        if (RECIPES.includes(r as Recipe) && !requestedRecipes.includes(r as Recipe) && requestedRecipes.length < 3) requestedRecipes.push(r as Recipe);
      });
    }
    if (requestedRecipes.length === 0) {
      // Pilih 3 resep berbeda: yang diminta + 2 variasi
      const primary: Recipe = RECIPES.includes(recipe as Recipe) ? (recipe as Recipe) : "hero_left_target";
      const others = RECIPES.filter((r) => r !== primary);
      requestedRecipes.push(primary, others[0], others[2]);
    }

    // --- Render 3 variasi secara paralel ---
    fs.mkdirSync(PROMO_DIR, { recursive: true });
    const imageProvider = getSetting("image_provider") || "renderer";
    const useGeminiImages = imageProvider === "gemini";
    const useOpenAiImages = imageProvider === "openai";
    let aiBackgroundPath: string | null = null;
    if (imageProvider === "cloudflare") {
      const background = await generateCloudflareBackground({ headline, format, mood, recipe: requestedRecipes[0], instructions: freeInstructions, referenceImagePath: referencePosterPath });
      aiBackgroundPath = path.join(PROMO_DIR, `.ai-bg-${crypto.randomUUID()}.png`);
      fs.writeFileSync(aiBackgroundPath, background);
    }

    const batchId = crypto.randomUUID();
    const renders = requestedRecipes.map((rec) => {
      const filename = `${crypto.randomUUID()}.${useGeminiImages || useOpenAiImages ? "png" : "jpg"}`;
      const previewFilename = `prev-${filename}`;
      const outPath = path.join(PROMO_DIR, filename);
      const prevPath = path.join(PROMO_DIR, previewFilename);

      const spec: Record<string, unknown> = {
        product_image: productPath,
        dish_image: dishPath,
        texture_image: texturePath,
        headline,
        tagline,
        format,
        recipe: rec,
        mood,
        benefits,
        price_text: price,
        old_price: oldPrice,
        discount_tag: discountTag,
        goal,
        brand_name: brandName,
        brand,
        instructions: freeInstructions,
        ...(aiBackgroundPath ? { background_image_path: aiBackgroundPath } : {}),
      };

      return { filename, previewFilename, outPath, prevPath, spec, recipe: rec };
    });

    // Render paralel dengan Promise.allSettled agar satu gagal tidak membatalkan semua
    const results = await Promise.allSettled(
      renders.map(async ({ spec, outPath, prevPath, recipe: rec }) => {
        if (!useGeminiImages && !useOpenAiImages) return runComposer(spec, outPath, prevPath);
        const image = useOpenAiImages
          ? await generateOpenAiPoster({
              productImagePath: productPath, styleReferencePath: referencePosterPath,
              headline, tagline, benefits, price, oldPrice, format, mood, recipe: rec, instructions: freeInstructions,
            })
          : await generateGeminiPoster({
              imagePaths: [productPath, dishPath, texturePath], headline, tagline, benefits, price, oldPrice,
              format, mood, recipe: rec, instructions: freeInstructions, styleReferencePath: referencePosterPath,
            });
        fs.writeFileSync(outPath, image);
        return { generated_by: useOpenAiImages ? "OpenAI GPT Image" : "Gemini Image" };
      })
    );
    if (aiBackgroundPath) fs.rmSync(aiBackgroundPath, { force: true });

    const designs: Array<{
      id: number;
      recipe: string;
      image_url: string;
      preview_url: string;
      download_url: string;
      quality_score: number;
      quality_passed: boolean;
    }> = [];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const { filename, recipe: rec } = renders[i];
      if (r.status === "rejected" || !fs.existsSync(renders[i].outPath)) continue;

      const meta = r.status === "fulfilled" ? r.value : {};
      const title = `${headline} — ${rec}`;
      const dbRes = db
        .prepare(
          "INSERT INTO promo_designs (title, layout_format, theme, items_json, output_filename) VALUES (?, ?, ?, ?, ?)"
        )
        .run(
          title,
          format,
          rec,
          JSON.stringify({
            recipe: rec,
            format,
            mood,
            headline,
            tagline,
            benefits,
            price_text: price,
            old_price: oldPrice,
            discount_tag: discountTag,
            goal,
            brand_name: brandName,
            brand,
            instructions: freeInstructions,
            image_id: imageId,
            dish_image_id: dishImageId,
            texture_image_id: textureImageId,
            batch_id: batchId,
          }),
          filename
        );
      const designId = Number(dbRes.lastInsertRowid);

      // Simpan filename preview juga (kalau ada)
      const previewFile = renders[i].previewFilename;
      if (fs.existsSync(renders[i].prevPath)) {
        try {
          db.prepare("UPDATE promo_designs SET preview_filename = ? WHERE id = ?").run(previewFile, designId);
        } catch { /* kolom mungkin belum ada */ }
      }

      designs.push({
        id: designId,
        recipe: rec,
        image_url: `/api/promo-file?id=${designId}`,
        preview_url: `/api/promo-file?id=${designId}&preview=1`,
        download_url: `/api/promo-file?id=${designId}&download=1`,
        quality_score: Number((meta as Record<string, unknown>).quality_score ?? 0),
        quality_passed: Boolean((meta as Record<string, unknown>).quality_passed ?? false),
      });
    }

    if (designs.length === 0) {
      const firstFailure = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
      return bad(firstFailure?.reason instanceof Error ? firstFailure.reason.message : "Semua variasi gagal dibuat.", 500);
    }

    db.prepare(
      "INSERT INTO promo_generation (design_id, batch_id, request_json, style, seed, is_saved) VALUES (?, ?, ?, ?, ?, 1)"
    ).run(designs[0].id, batchId, JSON.stringify(body), recipe, 0);

    logActivity("Buat Poster Studio", "promo", designs[0].id, `${headline}; resep: ${recipe}`);

    // --- Generate Caption ---
    let captionText = "";
    try {
      const textModel = getSetting("ai_provider") === "gemini" ? getSetting("gemini_text_model") : getSetting("text_model");
      const benStr = benefits.join(", ") || "-";
      const prompt = `Kamu copywriter media sosial profesional Indonesia. Tulis 1 caption Instagram menarik untuk:
- Produk: ${headline}
- Tagline: ${tagline || "-"}
- Harga: ${price || "lihat keterangan"}
- Manfaat: ${benStr}
- Tujuan: ${goal}
Mulai dengan hook emosional, jelaskan manfaat, akhiri dengan CTA, tambahkan 6-8 hashtag. Tulis langsung tanpa pengantar.`;

      const aiText = await Promise.race([
        generateAI({ model: textModel, prompt, temperature: 0.75 }),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
      ]);
      if (aiText && aiText.trim().length > 20) captionText = aiText.trim();
    } catch { /* Ollama tidak aktif → fallback */ }

    if (!captionText) {
      captionText = generateCaption({ headline, tagline, benefits, price, oldPrice, goal, brandName });
    }

    let captionId: number | null = null;
    try {
      const cRes = db
        .prepare(
          "INSERT INTO generated_contents (image_id, content_type, tone, content, model, is_saved) VALUES (?, ?, ?, ?, ?, 1)"
        )
        .run(imageId, "caption_instagram", "promosi", captionText, "scene-express");
      captionId = Number(cRes.lastInsertRowid);
    } catch { /* silent */ }

    return NextResponse.json({
      ok: true,
      batch_id: batchId,
      designs,
      caption: { id: captionId, text: captionText },
    });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Gagal memproses poster studio.", 500);
  } finally {
    if (referencePosterPath) fs.rmSync(referencePosterPath, { force: true });
  }
}

// GET: Revisi bahasa alami → render ulang satu desain
export async function PATCH(req: Request) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const designId = Number(body.design_id);
    if (!Number.isSafeInteger(designId) || designId <= 0) return bad("design_id tidak valid.");

    const db = getDb();
    const row = db.prepare("SELECT items_json, layout_format FROM promo_designs WHERE id = ?").get(designId) as
      | { items_json: string; layout_format: string }
      | undefined;
    if (!row) return bad("Desain tidak ditemukan.", 404);

    const prevSpec = JSON.parse(row.items_json || "{}") as Record<string, unknown>;
    const revision = clean(body.revision ?? "", 300);
    if (!revision) return bad("Tulis perubahan yang ingin diterapkan.");

    // Parse revisi bahasa alami (rule-based)
    const patch: Record<string, unknown> = {};
    const rev = revision.toLowerCase();
    if (rev.includes("gelap") || rev.includes("malam")) patch.mood = "dark";
    if (rev.includes("terang") || rev.includes("cerah")) patch.mood = "bright";
    if (rev.includes("mewah") || rev.includes("premium")) patch.mood = "luxury";
    if (rev.includes("besar") && rev.includes("produk")) patch.product_scale = 1.3;
    if (rev.includes("kecil") && rev.includes("produk")) patch.product_scale = 0.8;
    if (rev.includes("minimal")) patch.recipe = "minimal_luxury";
    if (rev.includes("tengah")) patch.recipe = "hero_center_burst";
    if (rev.includes("diagonal")) patch.recipe = "split_diagonal";
    if (rev.includes("bintang") || rev.includes("harga besar")) patch.recipe = "price_star";

    // Coba Ollama untuk revisi lebih kompleks
    if (Object.keys(patch).length === 0) {
      try {
        const textModel = getSetting("ai_provider") === "gemini" ? getSetting("gemini_text_model") : getSetting("text_model");
        const prompt = `Pengguna meminta revisi poster: "${revision}". 
Berikan JSON diff dari parameter berikut yang perlu diubah:
mood (dark/bright/warm/luxury), recipe (hero_left_target/hero_center_burst/split_diagonal/flatlay_overhead/price_star/minimal_luxury), product_scale (0.7-1.4), background_style (string), headline (string), tagline (string).
Jawab HANYA JSON, tidak ada teks lain. Contoh: {"mood":"dark","recipe":"minimal_luxury"}`;
        const aiRes = await Promise.race([
          generateAI({ model: textModel, prompt, temperature: 0.3 }),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error("timeout")), 6000)),
        ]);
        const parsed = JSON.parse(aiRes.trim()) as Record<string, unknown>;
        Object.assign(patch, parsed);
      } catch { /* fallback: gunakan patch kosong */ }
    }

    const safePatch: Record<string, unknown> = {};
    if (typeof patch.mood === "string" && MOODS.includes(patch.mood as (typeof MOODS)[number])) safePatch.mood = patch.mood;
    if (typeof patch.recipe === "string" && RECIPES.includes(patch.recipe as Recipe)) safePatch.recipe = patch.recipe;
    if (typeof patch.headline === "string") safePatch.headline = clean(patch.headline, 60);
    if (typeof patch.tagline === "string") safePatch.tagline = clean(patch.tagline, 80);
    if (typeof patch.background_style === "string") safePatch.background_style = clean(patch.background_style, 80);
    if (typeof patch.product_scale === "number" && Number.isFinite(patch.product_scale)) {
      safePatch.product_scale = Math.min(1.4, Math.max(0.7, patch.product_scale));
    }

    const newSpec = { ...prevSpec, ...safePatch };

    // Cari path foto produk dari DB
    const imageIdRaw = Number(prevSpec.image_id ?? body.image_id);
    if (!Number.isSafeInteger(imageIdRaw) || imageIdRaw <= 0) return bad("image_id tidak valid untuk revisi.");

    const imgRow = db.prepare("SELECT stored_filename FROM images WHERE id = ?").get(imageIdRaw) as
      | { stored_filename: string }
      | undefined;
    if (!imgRow) return bad("Foto produk tidak ditemukan untuk revisi.", 404);

    const { resolveUploadPath: rup } = await import("@/lib/storage");
    const productPath = rup(imgRow.stored_filename);
    if (!productPath || !fs.existsSync(productPath)) return bad("File foto tidak ditemukan.", 404);

    newSpec.product_image = productPath;
    const dishImageId = Number(prevSpec.dish_image_id);
    if (Number.isSafeInteger(dishImageId) && dishImageId > 0) {
      const dishRow = db.prepare("SELECT stored_filename FROM images WHERE id = ?").get(dishImageId) as { stored_filename: string } | undefined;
      const dishPath = dishRow ? rup(dishRow.stored_filename) : null;
      if (dishPath && fs.existsSync(dishPath)) newSpec.dish_image = dishPath;
    }
    const textureImageId = Number(prevSpec.texture_image_id);
    if (Number.isSafeInteger(textureImageId) && textureImageId > 0) {
      const textureRow = db.prepare("SELECT stored_filename FROM images WHERE id = ?").get(textureImageId) as { stored_filename: string } | undefined;
      const texturePath = textureRow ? rup(textureRow.stored_filename) : null;
      if (texturePath && fs.existsSync(texturePath)) newSpec.texture_image = texturePath;
    }

    const imageProvider = getSetting("image_provider") || "renderer";
    const useGeminiImages = imageProvider === "gemini";
    const useOpenAiImages = imageProvider === "openai";
    const useCloudflareImages = imageProvider === "cloudflare";
    const filename = `${crypto.randomUUID()}.${useGeminiImages || useOpenAiImages ? "png" : "jpg"}`;
    const prevFilename = `prev-${filename}`;
    const outPath = path.join(PROMO_DIR, filename);
    const prevPath = path.join(PROMO_DIR, prevFilename);

    fs.mkdirSync(PROMO_DIR, { recursive: true });
    const meta = useGeminiImages
      ? (await generateGeminiPoster({
          imagePaths: [productPath, newSpec.dish_image as string | null, newSpec.texture_image as string | null],
          headline: String(newSpec.headline ?? ""), tagline: String(newSpec.tagline ?? ""),
          benefits: Array.isArray(newSpec.benefits) ? newSpec.benefits as string[] : [],
          price: String(newSpec.price_text ?? ""), oldPrice: String(newSpec.old_price ?? ""),
          format: String(newSpec.format ?? "feed"), mood: String(newSpec.mood ?? "warm"),
          recipe: String(newSpec.recipe ?? ""), revision,
        }).then((image) => { fs.writeFileSync(outPath, image); return { generated_by: "Gemini Image" }; }))
      : useOpenAiImages
        ? await generateOpenAiPoster({
            productImagePath: productPath, headline: String(newSpec.headline ?? ""),
            tagline: String(newSpec.tagline ?? ""),
            benefits: Array.isArray(newSpec.benefits) ? newSpec.benefits as string[] : [],
            price: String(newSpec.price_text ?? ""), oldPrice: String(newSpec.old_price ?? ""),
            format: String(newSpec.format ?? "feed"), mood: String(newSpec.mood ?? "warm"),
            recipe: String(newSpec.recipe ?? ""), instructions: String(newSpec.instructions ?? ""), revision,
          }).then((image) => { fs.writeFileSync(outPath, image); return { generated_by: "OpenAI GPT Image" }; })
        : useCloudflareImages
          ? await (async () => {
              const background = await generateCloudflareBackground({
                headline: String(newSpec.headline ?? ""), format: String(newSpec.format ?? "feed"),
                mood: String(newSpec.mood ?? "warm"), recipe: String(newSpec.recipe ?? ""),
                instructions: String(newSpec.instructions ?? ""), revision,
              });
              const backgroundPath = path.join(PROMO_DIR, `.ai-bg-${crypto.randomUUID()}.png`);
              try {
                fs.writeFileSync(backgroundPath, background);
                newSpec.background_image_path = backgroundPath;
                return await runComposer(newSpec, outPath, prevPath);
              } finally { fs.rmSync(backgroundPath, { force: true }); }
            })()
        : await runComposer(newSpec, outPath, prevPath);

    const recipe = String(newSpec.recipe ?? row.layout_format ?? "hero_left_target");
    const headline = clean(newSpec.headline ?? "", 60);
    const title = `${headline} — ${recipe} [revisi]`;
    const dbRes = db
      .prepare(
        "INSERT INTO promo_designs (title, layout_format, theme, items_json, output_filename) VALUES (?, ?, ?, ?, ?)"
      )
      .run(title, String(newSpec.format ?? "feed"), recipe, JSON.stringify({ ...newSpec, parent_id: designId }), filename);
    const newDesignId = Number(dbRes.lastInsertRowid);
    if (fs.existsSync(prevPath)) {
      try {
        db.prepare("UPDATE promo_designs SET preview_filename = ? WHERE id = ?").run(prevFilename, newDesignId);
      } catch { /* skema lama belum memiliki kolom preview */ }
    }

    return NextResponse.json({
      ok: true,
      design: {
        id: newDesignId,
        recipe,
        parent_id: designId,
        image_url: `/api/promo-file?id=${newDesignId}`,
        preview_url: `/api/promo-file?id=${newDesignId}&preview=1`,
        download_url: `/api/promo-file?id=${newDesignId}&download=1`,
        quality_score: Number((meta as Record<string, unknown>).quality_score ?? 0),
        quality_passed: Boolean((meta as Record<string, unknown>).quality_passed ?? false),
        patch_applied: safePatch,
      },
    });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Gagal merevisi poster.", 500);
  }
}

