import { NextResponse } from "next/server";
import { getDb, getSetting } from "@/lib/db";
import { generateAI } from "@/lib/ollama";

const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

export async function POST(req: Request) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const imageId = Number(body.image_id);
    const headline = clean(body.headline, 80);
    if (!Number.isSafeInteger(imageId) || imageId <= 0 || !headline) {
      return NextResponse.json({ error: "Pilih foto dan isi nama produk terlebih dahulu." }, { status: 400 });
    }

    const db = getDb();
    const image = db.prepare("SELECT id FROM images WHERE id = ?").get(imageId);
    if (!image) return NextResponse.json({ error: "Foto produk tidak ditemukan." }, { status: 404 });

    const analysis = db.prepare(
      "SELECT description, objects, visible_text FROM image_analysis WHERE image_id = ? ORDER BY id DESC LIMIT 1"
    ).get(imageId) as { description?: string; objects?: string; visible_text?: string } | undefined;
    const productFacts = [analysis?.description, analysis?.objects, analysis?.visible_text]
      .filter(Boolean)
      .join("; ")
      .slice(0, 500);

    try {
      const response = await generateAI({
        model: getSetting("ai_provider") === "gemini" ? getSetting("gemini_text_model") : getSetting("text_model"),
        temperature: 0.8,
        prompt: `Buat tepat 3 pilihan tagline pendek dalam Bahasa Indonesia untuk produk "${headline}".${productFacts ? ` Fakta yang terlihat: ${productFacts}.` : ""} Maksimal 8 kata tiap tagline. Jangan menambahkan klaim manfaat, bahan, atau sertifikasi yang tidak diberikan. Jawab satu tagline per baris tanpa nomor atau pengantar.`,
      });
      const suggestions = response
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/^['"“”]+|['"“”]+$/g, "").trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((line) => line.slice(0, 80));
      if (suggestions.length) return NextResponse.json({ suggestions });
    } catch {
      // Saran manual tetap tersedia saat Ollama belum aktif.
    }

    return NextResponse.json({
      suggestions: [
        `${headline}: Pilihan untuk Hari Ini`,
        `Temukan ${headline} Favoritmu`,
        `${headline}, Hadirkan Momen Istimewa`,
      ].map((line) => line.slice(0, 80)),
    });
  } catch {
    return NextResponse.json({ error: "Permintaan saran tagline tidak valid." }, { status: 400 });
  }
}
