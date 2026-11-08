import { getSetting } from "./db";

export function ollamaBase(): string {
  return getSetting("ollama_url") || "http://localhost:11434";
}

export function ollamaTimeoutMs(): number {
  const s = Number(getSetting("ollama_timeout_seconds"));
  return (Number.isFinite(s) && s > 0 ? s : 600) * 1000;
}

// Memanggil /api/generate milik Ollama dari server (tidak pernah dari browser)
export async function ollamaGenerate(opts: {
  model: string;
  prompt: string;
  images?: string[];
  json?: boolean;
    temperature?: number;
}): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${ollamaBase()}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        prompt: opts.prompt,
        images: opts.images,
        stream: false,
        format: opts.json ? "json" : undefined,
         options: { temperature: opts.temperature ?? 0.2 },
      }),
      signal: AbortSignal.timeout(ollamaTimeoutMs()),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "TimeoutError") {
      throw new Error("Ollama terlalu lama merespons (timeout).");
    }
    throw new Error(
      "Tidak dapat terhubung ke Ollama. Pastikan aplikasi Ollama sedang berjalan."
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { response?: string };
  return (data.response ?? "").trim();
}

type GenerateOptions = {
  model: string;
  prompt: string;
  images?: string[];
  imageMimeType?: string;
  json?: boolean;
  temperature?: number;
};

export async function generateAI(opts: GenerateOptions): Promise<string> {
  if (getSetting("ai_provider") !== "gemini") return ollamaGenerate(opts);

  const apiKey = getSetting("gemini_api_key");
  if (!apiKey) throw new Error("Gemini API key belum diatur. Buka Pengaturan untuk memasukkannya.");
  const model = opts.model || (opts.images ? getSetting("gemini_vision_model") : getSetting("gemini_text_model"));
  const parts: Record<string, unknown>[] = [{ text: opts.prompt }];
  for (const data of opts.images ?? []) {
    parts.push({ inline_data: { mime_type: opts.imageMimeType || "image/jpeg", data } });
  }

  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: opts.temperature ?? 0.2,
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
      signal: AbortSignal.timeout(ollamaTimeoutMs()),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw new Error("Gemini API terlalu lama merespons (timeout).");
    throw new Error("Tidak dapat terhubung ke Gemini API. Periksa koneksi internet.");
  }

  const payload = await response.json().catch(() => ({})) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (!response.ok) {
    const reason = payload.error?.message || `HTTP ${response.status}`;
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new Error(`Gemini API menolak permintaan: ${reason}`);
    }
    throw new Error(`Gemini API error: ${reason.slice(0, 240)}`);
  }
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini tidak menghasilkan teks. Periksa model dan isi permintaan.");
  return text;
}
