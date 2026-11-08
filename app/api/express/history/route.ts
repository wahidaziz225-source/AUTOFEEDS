import { getDb } from "@/lib/db";

type PromoRow = {
  id: number;
  title: string;
  layout_format: string;
  theme: string;
  items_json: string;
  created_at: string;
};

export async function GET() {
  try {
    const rows = getDb()
      .prepare("SELECT id, title, layout_format, theme, items_json, created_at FROM promo_designs ORDER BY id DESC LIMIT 200")
      .all() as PromoRow[];

    const designs = rows.flatMap((row) => {
      try {
        const spec = JSON.parse(row.items_json) as Record<string, unknown>;
        // Express stores image_id for generated posters and parent_id for revisions.
        if (typeof spec.image_id !== "number" && typeof spec.parent_id !== "number") return [];
        const recipe = String(spec.recipe ?? row.theme ?? "poster");
        return [{
          id: row.id,
          title: row.title,
          headline: String(spec.headline ?? row.title),
          format: String(spec.format ?? row.layout_format),
          recipe,
          created_at: row.created_at,
          image_url: `/api/promo-file?id=${row.id}`,
          preview_url: `/api/promo-file?id=${row.id}&preview=1`,
          download_url: `/api/promo-file?id=${row.id}&download=1`,
        }];
      } catch {
        return [];
      }
    });

    return Response.json({ designs });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Riwayat poster gagal dimuat." }, { status: 500 });
  }
}
