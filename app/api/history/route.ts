import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

type Row = {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: string | null;
  created_at: string;
};

// GET /api/history?limit=50&offset=0
// Riwayat aktivitas, tanpa catatan pemeriksaan kesehatan sistem.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 50), 1), 200);
  const offset = Math.max(Math.trunc(Number(url.searchParams.get("offset")) || 0), 0);

  const db = getDb();
  const total = (
    db
      .prepare("SELECT COUNT(*) AS n FROM activity_logs WHERE action != 'health_check'")
      .get() as { n: number }
  ).n;
  const rows = db
    .prepare(
      `SELECT id, action, entity_type, entity_id, details, created_at
       FROM activity_logs WHERE action != 'health_check'
       ORDER BY id DESC LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as Row[];

  return NextResponse.json({ total, limit, offset, activities: rows });
}
