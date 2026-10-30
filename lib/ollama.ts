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