// Daftar pengaturan yang boleh diubah dari halaman Settings, beserta aturan validasinya.
// Dipakai bersama oleh API (validasi di server) dan halaman (label & petunjuk).

export type SettingField = {
  key: string;
  label: string;
  hint: string;
  kind: "text" | "password" | "number" | "select";
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
};

export const SETTING_FIELDS: SettingField[] = [
  {
    key: "ai_provider",
    label: "Penyedia AI",
    hint: "Gemini API memakai layanan Google AI; Ollama menjalankan model di komputer ini.",
    kind: "select",
    options: [
      { value: "gemini", label: "Google Gemini API" },
      { value: "ollama", label: "Ollama lokal" },
    ],
  },
  {
    key: "gemini_api_key",
    label: "Gemini API key",
    hint: "Dibutuhkan untuk Gemini. Kunci disimpan di database lokal dan tidak ditampilkan kembali.",
    kind: "password",
  },
  {
    key: "image_provider",
    label: "Mesin visual poster",
    hint: "Untuk poster penuh pilih OpenAI atau Gemini. Cloudflare hanya membuat latar dan memakai layout Auto Feeds.",
    kind: "select",
    options: [
      { value: "cloudflare", label: "Cloudflare FLUX (latar saja, hemat biaya)" },
      { value: "openai", label: "OpenAI GPT Image (poster penuh, kualitas tinggi)" },
      { value: "gemini", label: "Google Gemini Image (poster penuh)" },
      { value: "renderer", label: "Renderer lokal (tanpa API gambar)" },
    ],
  },
  {
    key: "cloudflare_account_id",
    label: "Cloudflare Account ID",
    hint: "Temukan di dashboard Cloudflare pada halaman Workers AI.",
    kind: "text",
  },
  {
    key: "cloudflare_api_token",
    label: "Cloudflare Workers AI API token",
    hint: "Buat token untuk Workers AI. Token disimpan lokal dan tidak ditampilkan kembali.",
    kind: "password",
  },
  {
    key: "cloudflare_image_model",
    label: "Model Cloudflare Image",
    hint: "Default: @cf/black-forest-labs/flux-2-klein-4b",
    kind: "text",
  },
  {
    key: "openai_api_key",
    label: "OpenAI API key",
    hint: "Dibutuhkan jika mesin visual OpenAI dipilih. Disimpan lokal dan tidak ditampilkan kembali.",
    kind: "password",
  },
  {
    key: "openai_image_model",
    label: "Model OpenAI Image",
    hint: "Contoh: gpt-image-2.5-sunburst. Membuat poster lengkap; biaya API OpenAI berlaku untuk tiap variasi.",
    kind: "text",
  },
  {
    key: "gemini_text_model",
    label: "Model Gemini teks",
    hint: "Contoh: gemini-2.5-flash",
    kind: "text",
  },
  {
    key: "gemini_vision_model",
    label: "Model Gemini analisis gambar",
    hint: "Contoh: gemini-2.5-flash",
    kind: "text",
  },
  {
    key: "gemini_image_model",
    label: "Model Gemini pembuat poster",
    hint: "Model gambar, contoh: gemini-2.5-flash-image",
    kind: "text",
  },
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

const MODEL_RE = /^[A-Za-z0-9@][A-Za-z0-9@._:/-]{0,99}$/;

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
  if (key === "vision_model" || key === "text_model" || key === "gemini_text_model" || key === "gemini_vision_model" || key === "gemini_image_model" || key === "openai_image_model" || key === "cloudflare_image_model") {
    return MODEL_RE.test(v)
      ? { ok: true, value: v }
      : { ok: false, error: `${field.label}: nama model tidak valid.` };
  }
  if (key === "gemini_api_key" || key === "openai_api_key") {
    return v.length <= 300 && (v.length === 0 || /^[A-Za-z0-9._-]+$/.test(v))
      ? { ok: true, value: v }
      : { ok: false, error: "Gemini API key memiliki format yang tidak valid." };
  }
  if (key === "cloudflare_api_token") {
    return v.length <= 300 && (v.length === 0 || /^[A-Za-z0-9._-]+$/.test(v))
      ? { ok: true, value: v }
      : { ok: false, error: "Cloudflare API token memiliki format yang tidak valid." };
  }
  if (key === "cloudflare_account_id") {
    return /^[a-fA-F0-9]{32}$/.test(v)
      ? { ok: true, value: v.toLowerCase() }
      : { ok: false, error: "Cloudflare Account ID harus berisi 32 karakter heksadesimal." };
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
