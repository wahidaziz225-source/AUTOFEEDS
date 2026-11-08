"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { SETTING_FIELDS } from "@/lib/settings-options";
import { Card, ErrorBanner, LoadingState, PageHeader } from "@/components/ui";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [hasGeminiApiKey, setHasGeminiApiKey] = useState(false);
  const [hasOpenAiApiKey, setHasOpenAiApiKey] = useState(false);
  const [hasCloudflareApiToken, setHasCloudflareApiToken] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal memuat pengaturan.");
        setValues(data.settings);
        setHasGeminiApiKey(Boolean(data.hasGeminiApiKey));
        setHasOpenAiApiKey(Boolean(data.hasOpenAiApiKey));
        setHasCloudflareApiToken(Boolean(data.hasCloudflareApiToken));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat pengaturan.");
      }
    })();
  }, []);

  function change(key: string, value: string) {
    if (!values) return;
    setSaved(false);
    setValues({ ...values, [key]: value });
  }

  async function save() {
    if (!values) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan pengaturan.");
      setValues(data.settings);
      setHasGeminiApiKey(Boolean(data.hasGeminiApiKey));
      setHasOpenAiApiKey(Boolean(data.hasOpenAiApiKey));
      setHasCloudflareApiToken(Boolean(data.hasCloudflareApiToken));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan pengaturan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Settings"
        description="Pilih AI untuk teks dan mesin visual untuk poster. Kunci API disimpan di komputer ini."
      />
      <ErrorBanner message={error} />

      {!values && !error && <LoadingState label="Memuat pengaturan..." />}

      {values && (
        <Card className="space-y-5">
          {SETTING_FIELDS.filter((f) => {
            if (values.ai_provider === "gemini" ? ["ollama_url", "vision_model", "text_model"].includes(f.key) : ["gemini_text_model", "gemini_vision_model"].includes(f.key)) return false;
            if (f.key === "gemini_image_model" && values.image_provider !== "gemini") return false;
            if (["openai_api_key", "openai_image_model"].includes(f.key) && values.image_provider !== "openai") return false;
            if (["cloudflare_account_id", "cloudflare_api_token", "cloudflare_image_model"].includes(f.key) && values.image_provider !== "cloudflare") return false;
            if (f.key === "gemini_api_key" && values.ai_provider !== "gemini" && values.image_provider !== "gemini") return false;
            return true;
          }).map((f) => (
            <label key={f.key} className="block text-sm font-medium text-slate-700">
              {f.label}
              {f.kind === "select" ? (
                <select
                  className={inputCls}
                  value={values[f.key] ?? ""}
                  onChange={(e) => change(f.key, e.target.value)}
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={inputCls}
                  type={f.kind === "number" ? "number" : f.kind === "password" ? "password" : "text"}
                  min={f.min}
                  max={f.max}
                  value={values[f.key] ?? ""}
                  placeholder={f.key === "cloudflare_api_token" && hasCloudflareApiToken ? "Token tersimpan; isi hanya untuk mengganti" : f.key === "openai_api_key" && hasOpenAiApiKey ? "Kunci tersimpan; isi hanya untuk mengganti" : f.key === "gemini_api_key" && hasGeminiApiKey ? "Kunci tersimpan; isi hanya untuk mengganti" : undefined}
                  onChange={(e) => change(f.key, e.target.value)}
                />
              )}
              <span className="mt-1 block text-xs font-normal text-slate-500">{f.hint}</span>
            </label>
          ))}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Simpan
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
                <CheckCircle2 size={16} /> Tersimpan
              </span>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
