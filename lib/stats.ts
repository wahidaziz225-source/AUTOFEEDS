import { getDb } from "./db";

export type RecentActivity = {
  id: number;
  action: string;
  details: string | null;
  created_at: string;
};

export type Stats = {
  totalImages: number;
  totalContents: number;
  totalSavedCaptions: number;
  totalAnalyses: number;
  recent: RecentActivity[];
};

function count(sql: string): number {
  const row = getDb().prepare(sql).get() as { n: number };
  return row.n;
}

export function getStats(): Stats {
  const db = getDb();
  return {
    totalImages: count("SELECT COUNT(*) AS n FROM images"),
    totalContents: count("SELECT COUNT(*) AS n FROM generated_contents"),
    totalSavedCaptions: count(
      "SELECT COUNT(*) AS n FROM generated_contents WHERE is_saved = 1 AND content_type IN ('caption_instagram','caption_facebook')"
    ),
    totalAnalyses: count("SELECT COUNT(*) AS n FROM image_analysis"),
    recent: db
      .prepare(
        "SELECT id, action, details, created_at FROM activity_logs WHERE action != 'health_check' ORDER BY id DESC LIMIT 8"
      )
      .all() as RecentActivity[],
  };
}

export type OllamaStatus = {
  online: boolean;
  models: string[];
  error?: string;
};

// Dicek dari server, jadi alamat Ollama tidak pernah terlihat oleh browser
export async function getOllamaStatus(baseUrl: string): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { models?: { name: string }[] };
    return { online: true, models: (data.models ?? []).map((m) => m.name) };
  } catch (e) {
    return {
      online: false,
      models: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}