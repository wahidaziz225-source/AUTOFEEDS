import { NextResponse } from "next/server";
import { getSetting, logActivity, setSetting } from "@/lib/db";
import { SETTING_FIELDS, validateSetting } from "@/lib/settings-options";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET() {
  const settings: Record<string, string> = {};
  for (const f of SETTING_FIELDS) settings[f.key] = getSetting(f.key);
  return NextResponse.json({ settings });
}

// Body: { settings: { key: value, ... } }. Semua nilai divalidasi dulu; jika ada yang salah, tidak ada yang disimpan.
export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as { settings?: Record<string, unknown> };
    const input = body.settings;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return bad("Permintaan tidak valid.");
    }

    const clean: [string, string][] = [];
    for (const [key, raw] of Object.entries(input)) {
      const r = validateSetting(key, raw);
      if (!r.ok) return bad(r.error);
      clean.push([key, r.value]);
    }
    if (clean.length === 0) return bad("Tidak ada pengaturan yang dikirim.");

    for (const [key, value] of clean) setSetting(key, value);
    logActivity("Ubah pengaturan", "settings", null, clean.map(([k]) => k).join(", "));

    const settings: Record<string, string> = {};
    for (const f of SETTING_FIELDS) settings[f.key] = getSetting(f.key);
    return NextResponse.json({ settings });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Gagal menyimpan pengaturan.", 500);
  }
}
