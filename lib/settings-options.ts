// Daftar pengaturan yang boleh diubah dari halaman Settings, beserta aturan validasinya.
// Dipakai bersama oleh API (validasi di server) dan halaman (label & petunjuk).

export type SettingField = {
  key: string;
  label: string;
  hint: string;
  kind: "text" | "number" | "select";
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
};

export const SETTING_FIELDS: SettingField[] = [
  {
    key: "ollama_url",
    label: "Alamat Ollama",
    hint: "Biasanya http://localhost:11434",
    kind: "text",
  },
  {
    key: "vision_model",
    label: "Model analisis gambar",
    hint: "Contoh: qwen2.5vl:3b",
    kind: "text",
  },
  {
    key: "text_model",
    label: "Model teks (caption)",
    hint: "Contoh: qwen2.5:3b",
    kind: "text",
  },
  {
    key: "ollama_timeout_seconds",
    label: "Batas waktu Ollama (detik)",
    hint: "10 sampai 3600. Naikkan jika komputer lambat.",
    kind: "number",
    min: 10,
    max: 3600,
  },
  {
    key: "max_upload_mb",
    label: "Ukuran upload maksimum (MB)",
    hint: "1 sampai 50.",
    kind: "number",
    min: 1,
    max: 50,
  },
  {
    key: "default_language",
    label: "Bahasa konten",
    hint: "Bahasa default untuk teks yang dihasilkan.",
    kind: "select",
    options: [
      { value: "id", label: "Indonesia" },
      { value: "en", label: "English" },
    ],
  },
];

const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/;

export type SettingCheck = { ok: true; value: string } | { ok: false; error: string };

export function validateSetting(key: string, raw: unknown): SettingCheck {
  const field = SETTING_FIELDS.find((f) => f.key === key);
  if (!field) return { ok: false, error: `Pengaturan "${key}" tidak dikenal.` };
  const v = String(raw ?? "").trim();

  if (key === "ollama_url") {
    try {
      const u = new URL(v);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
      return { ok: true, value: u.origin };
    } catch {
      return { ok: false, error: "Alamat Ollama harus berupa URL http:// atau https://." };
    }
  }
  if (key === "vision_model" || key === "text_model") {
    return MODEL_RE.test(v)
      ? { ok: true, value: v }
      : { ok: false, error: `${field.label}: nama model tidak valid.` };
  }
  if (field.kind === "number") {
    const n = Number(v);
    if (!Number.isInteger(n) || n < (field.min ?? 0) || n > (field.max ?? Infinity)) {
      return { ok: false, error: `${field.label}: isi bilangan bulat ${field.min}–${field.max}.` };
    }
    return { ok: true, value: String(n) };
  }
  if (field.kind === "select") {
    return field.options?.some((o) => o.value === v)
      ? { ok: true, value: v }
      : { ok: false, error: `${field.label}: pilihan tidak valid.` };
  }
  return { ok: true, value: v };
}
