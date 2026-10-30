"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Sparkles,
  Copy,
  Download,
  Save,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { CONTENT_TYPES, TONES } from "@/lib/content";

type Img = { id: number; name: string };
type Analysis = {
  id: number;
  description: string | null;
  objects: string | null;
  dominant_colors: string | null;
  visible_text: string | null;
  context: string | null;
};
type Item = {
  id: number;
  content_type: string;
  tone: string | null;
  content: string;
  is_edited: number;
  is_saved: number;
  created_at: string;
};

const typeLabel = (id: string) => CONTENT_TYPES.find((t) => t.id === id)?.label ?? id;
const toneLabel = (id: string | null) => TONES.find((t) => t.id === id)?.label ?? "";

export default function ContentStudioPage() {
  const [images, setImages] = useState<Img[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [form, setForm] = useState({
    description: "",
    objects: "",
    dominant_colors: "",
    visible_text: "",
    context: "",
  });
  const [extra, setExtra] = useState("");
  const [type, setType] = useState<string>("caption_instagram");
  const [tone, setTone] = useState<string>("santai");
  const [items, setItems] = useState<Item[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const flash = (m: string) => {
    setNotice(m);
    setTimeout(() => setNotice(""), 2500);
  };

  const loadContents = useCallback(async (imageId: number) => {
    const res = await fetch(`/api/content?image_id=${imageId}`, { cache: "no-store" });
    const data = await res.json();
    const list: Item[] = data.contents ?? [];
    setItems(list);
    setDrafts(Object.fromEntries(list.map((i) => [i.id, i.content])));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/images", { cache: "no-store" });
        const data = await res.json();
        setImages(data.images ?? []);
      } catch {
        setError("Gagal memuat daftar gambar.");
      }
    })();
  }, []);

  async function select(id: number) {
    setSelected(id);
    setError("");
    setAnalysis(null);
    setItems([]);
    try {
      const res = await fetch(`/api/analyze?image_id=${id}`, { cache: "no-store" });
      const data = await res.json();
      const a: Analysis | null = data.analysis ?? null;
      setAnalysis(a);
      if (a) {
        setForm({
          description: a.description ?? "",
          objects: a.objects ?? "",
          dominant_colors: a.dominant_colors ?? "",
          visible_text: a.visible_text ?? "",
          context: a.context ?? "",
        });
      }
      await loadContents(id);
    } catch {
      setError("Gagal memuat data gambar.");
    }
  }

  async function saveAnalysis(): Promise<boolean> {
    if (!analysis) return false;
    const res = await fetch("/api/analysis", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: analysis.id, ...form }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Gagal menyimpan analisis.");
      return false;
    }
    return true;
  }

  async function generate(useType = type, useTone = tone) {
    if (selected == null) return;
    setGenerating(true);
    setError("");
    try {
      if (!(await saveAnalysis())) return;
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_id: selected,
          content_type: useType,
          tone: useTone,
          extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat konten.");
      await loadContents(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat konten.");
    } finally {
      setGenerating(false);
    }
  }

  async function patchItem(item: Item, patch: { content?: string; is_saved?: boolean }) {
    try {
      const res = await fetch("/api/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan.");
      if (selected != null) await loadContents(selected);
      flash(patch.is_saved === false ? "Dikeluarkan dari Library." : "Tersimpan.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
    }
  }

  async function removeItem(item: Item) {
    if (!confirm("Hapus konten ini?")) return;
    try {
      const res = await fetch(`/api/content?id=${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menghapus.");
      if (selected != null) await loadContents(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash("Disalin ke clipboard.");
    } catch {
      setError("Gagal menyalin. Blok teks lalu tekan Ctrl+C.");
    }
  }

  function download(item: Item) {
    const blob = new Blob([drafts[item.id] ?? item.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.content_type}-${item.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const field = (key: keyof typeof form, label: string, rows = 2) => (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <textarea
        rows={rows}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
      />
    </label>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Content Studio</h1>
        <p className="text-sm text-slate-500">
          Buat caption, hashtag, headline, dan deskripsi dari hasil analisis gambar.
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 ring-1 ring-emerald-200">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Pilih gambar ({images.length})</h2>
          {images.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada gambar. Unggah dulu di Image Upload.</p>
          ) : (
            <div className="grid max-h-[32rem] grid-cols-2 gap-3 overflow-y-auto">
              {images.map((img) => (
                <button
                  key={img.id}
                  onClick={() => select(img.id)}
                  className={`overflow-hidden rounded-xl text-left ring-2 transition ${
                    selected === img.id ? "ring-indigo-500" : "ring-transparent hover:ring-slate-300"
                  }`}
                >
                  <img
                    src={`/api/image-file?id=${img.id}`}
                    alt={img.name}
                    loading="lazy"
                    className="h-24 w-full object-cover"
                  />
                  <div className="truncate bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700">
                    {img.name}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-5 lg:col-span-2">
          {selected == null ? (
            <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
              Pilih satu gambar di sebelah kiri.
            </div>
          ) : !analysis ? (
            <div className="rounded-2xl bg-white p-6 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
              Gambar ini belum dianalisis. Buka menu <b>AI Image Analyzer</b>, jalankan analisis, lalu kembali ke sini.
            </div>
          ) : (
            <>
              <div className="space-y-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">
                  Hasil analisis (boleh diedit jika ada yang keliru)
                </h2>
                {field("description", "Deskripsi", 3)}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {field("objects", "Objek / produk")}
                  {field("dominant_colors", "Warna dominan")}
                  {field("visible_text", "Teks terbaca")}
                  {field("context", "Konteks")}
                </div>
                <label className="block text-xs font-medium text-slate-500">
                  Info tambahan (opsional): nama produk, harga, promo, nomor WhatsApp
                  <textarea
                    rows={2}
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                    placeholder="Contoh: Nugget Ayam 170 g, Rp25.000, beli 2 gratis 1, WA 08xx"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
              </div>

              <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Jenis konten
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CONTENT_TYPES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setType(t.id)}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                          type === t.id
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Gaya bahasa
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TONES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTone(t.id)}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                          tone === t.id
                            ? "bg-violet-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => generate()}
                  disabled={generating}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {generating ? "Membuat konten..." : "Buat konten"}
                </button>
                {generating && (
                  <p className="text-xs text-slate-500">
                    Model teks berjalan di CPU, biasanya 10 detik sampai 1 menit.
                  </p>
                )}
              </div>

              {items.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-slate-900">Hasil ({items.length})</h2>
                  {items.map((item) => {
                    const draft = drafts[item.id] ?? item.content;
                    const changed = draft !== item.content;
                    return (
                      <div
                        key={item.id}
                        className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-700">
                            {typeLabel(item.content_type)}
                          </span>
                          {item.tone && (
                            <span className="rounded-full bg-violet-50 px-3 py-1 font-semibold text-violet-700">
                              {toneLabel(item.tone)}
                            </span>
                          )}
                          {item.is_saved === 1 && (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">
                              Tersimpan di Library
                            </span>
                          )}
                          {item.is_edited === 1 && <span className="text-slate-400">diedit</span>}
                        </div>
                        <textarea
                          rows={Math.min(14, Math.max(4, draft.split("\n").length + 1))}
                          value={draft}
                          onChange={(e) => setDrafts({ ...drafts, [item.id]: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        />
                        <div className="flex flex-wrap gap-2 text-xs font-medium">
                          {item.is_saved === 1 ? (
                            <>
                              {changed && (
                                <button
                                  onClick={() => patchItem(item, { content: draft })}
                                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700"
                                >
                                  <Save size={14} /> Simpan perubahan
                                </button>
                              )}
                              <button
                                onClick={() => patchItem(item, { is_saved: false })}
                                className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-slate-700 hover:bg-slate-200"
                              >
                                Keluarkan dari Library
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => patchItem(item, { content: draft, is_saved: true })}
                              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700"
                            >
                              <Save size={14} /> Simpan ke Library
                            </button>
                          )}
                          <button
                            onClick={() => copyText(draft)}
                            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-slate-700 hover:bg-slate-200"
                          >
                            <Copy size={14} /> Salin
                          </button>
                          <button
                            onClick={() => download(item)}
                            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-slate-700 hover:bg-slate-200"
                          >
                            <Download size={14} /> Unduh .txt
                          </button>
                          <button
                            onClick={() =>
                              generate(item.content_type, item.tone ?? tone)
                            }
                            disabled={generating}
                            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                          >
                            <RefreshCw size={14} /> Buat ulang
                          </button>
                          <button
                            onClick={() => removeItem(item)}
                            className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 size={14} /> Hapus
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}