import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL, DEFAULT_SETTINGS, DEFAULT_CATEGORIES } from "./schema";

const DB_DIR = path.join(process.env.AUTOFEEDS_DATA_DIR || process.cwd(), "database");
export const DB_PATH = path.join(DB_DIR, "autofeeds.db");

// Satu koneksi saja, tetap aman saat Next.js memuat ulang kode di mode dev
const globalForDb = globalThis as unknown as {
  __autofeedsDb?: Database.Database;
};

function initDb(): Database.Database {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);

  // Migrasi tambahan: tambah kolom opsional yang mungkin belum ada di DB lama
  const migrations = [
    "ALTER TABLE promo_designs ADD COLUMN preview_filename TEXT",
  ];
  for (const m of migrations) {
    try { db.exec(m); } catch { /* kolom sudah ada */ }
  }

  const insertSetting = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
  );
  const insertCategory = db.prepare(
    "INSERT OR IGNORE INTO categories (name) VALUES (?)"
  );
  db.transaction(() => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      insertSetting.run(key, value);
    }
    for (const name of DEFAULT_CATEGORIES) {
      insertCategory.run(name);
    }
  })();

  return db;
}

export function getDb(): Database.Database {
  if (!globalForDb.__autofeedsDb) {
    globalForDb.__autofeedsDb = initDb();
  }
  return globalForDb.__autofeedsDb;
}

export function getSetting(key: string): string {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? DEFAULT_SETTINGS[key] ?? "";
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    )
    .run(key, value);
}

export function logActivity(
  action: string,
  entityType: string | null = null,
  entityId: number | null = null,
  details: string | null = null
): void {
  getDb()
    .prepare(
      "INSERT INTO activity_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)"
    )
    .run(action, entityType, entityId, details);
}