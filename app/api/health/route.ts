import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { ensureUploadDir, UPLOAD_DIR } from "@/lib/storage";

export async function GET() {
  try {
    const db = getDb();

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as { name: string }[];

    // Catat satu aktivitas tiap pemeriksaan (untuk menguji data bertahan setelah restart)
    logActivity("health_check");
    const logCount = (
      db.prepare("SELECT COUNT(*) AS n FROM activity_logs").get() as { n: number }
    ).n;

    // Uji folder upload bisa ditulisi
    ensureUploadDir();
    const probe = path.join(UPLOAD_DIR, `.probe-${crypto.randomUUID()}`);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);

    return NextResponse.json({
      status: "ok",
      database: {
        tables: tables.map((t) => t.name),
        activity_logs_count: logCount,
      },
      storage: { writable: true },
    });
  } catch (e) {
    return NextResponse.json(
      { status: "error", message: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
