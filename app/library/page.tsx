"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Copy,
  Download,
  Save,
  Trash2,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { CONTENT_TYPES, TONES } from "@/lib/content";

type Category = { id: number; name: string };
type Item = {
  id: number;
  image_id: number;
  image_name: string;
  category_name: string | null;
  content_type: string;
  tone: string | null;
  content: string;
  is_edited: number;
  created_at: string;
  description: string | null;
  objects: string | null;
  dominant_colors: string | null;
  visible_text: string | null;
  context: string | null;
};

const typeLabel = (id: string) => CONTENT_TYPES.find((t) => t.id === id)?.label ?? id;
const toneLabel = (id: string | null) => TONES.find((t) => t.id === id)?.label ?? "";

function formatDate(s: string): string {
  const d = new Date(s.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? s : d.toLocaleString("id-ID");
}

export default function LibraryPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const flash = (m: string) => {
    setNotice(m);
    setTimeout(() => setNotice(""), 2500);
  };

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (cat) params.set("category_id", cat);
    if (type) params.set("type", type);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    try {
      const res = await fetch(`/api/library?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat Library.");
      const list: Item[] = data.items ?? [];
      setItems(list);
      setDrafts(Object.fromEntries(list.map((i) => [i.id, i.content])));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat Library.");
    } finally {
      setLoading(false);
    }
  }, [q, cat, type, from, to]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/categories", { cache: "no-store" });
        const data = await res.json();
        setCategories(data.categories ?? []);
      } catch {
        /* filter kategori opsional */
      }
    })();
  }, []);

  // Muat ulang otomatis 300 ms setelah filter berubah
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function patch(item: Item, body: { content?: string; is_saved?: boolean }) {
    try {
      const res = await fetch("/api/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan.");
      flash(body.is_saved === false ? "Dikeluarkan dari Library." : "Perubahan tersimpan.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
    }
  }

  async function remove(item: Item) {
    if (!confirm("Hapus konten ini secara permanen?")) return;
    try {
      const res = await fetch(`/api/content?id=${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menghapus.");
      flash("Konten dihapus.");
      await load();
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

  function resetFilters() {
    setQ("");
    setCat("");
    setType("");
    setFrom("");
    setTo("");
  }

  const hasFilter = q || cat || type || from || to;
  const inputCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Content Library</h1>
        <p className="text-sm text-slate-500">
          Konten yang sudah Anda simpan. Cari, filter, edit, dan pakai kembali.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2 lg:grid-cols-5">
        <label className="relative sm:col-span-2 lg:col-span-5">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari isi konten atau nama gambar..."
            className={`${inputCls} pl-9`}
          />
        </label>
        <label className="text-xs font-medium text-slate-500">
          Kategori
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={`${inputCls} mt-1`}>
            <option value="">Semua</option>
            <option value="0">Tanpa kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500">
          Jenis konten
          <select value={type} onChange={(e) => setType(e.target.value)} className={`${inputCls} mt-1`}>
            <option value="">Semua</option>
            {CONTENT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500">
          Dari tanggal
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        <label className="text-xs font-medium text-slate-500">
          Sampai tanggal
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        <div className="flex items-end">
          {hasFilter ? (
            <button
              onClick={resetFilters}
              className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Reset filter
            </button>
          ) : null}
        </div>
      </section>

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

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Memuat...
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-500 ring-1 ring-slate-200">
          {hasFilter
            ? "Tidak ada konten yang cocok dengan filter."
            : "Library masih kosong. Buat konten di Content Studio lalu klik Simpan ke Library."}
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">{items.length} konten</p>
          {items.map((item) => {
            const draft = drafts[item.id] ?? item.content;
            const changed = draft !== item.content;
            return (
              <article
                key={item.id}
                className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:flex-row"
              >
                <img
                  src={`/api/image-file?id=${item.image_id}&size=small`}
                  alt={item.image_name}
                  loading="lazy"
                  className="h-40 w-full shrink-0 rounded-xl object-cover sm:w-40"
                />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-700">
                      {typeLabel(item.content_type)}
                    </span>
                    {item.tone && (
                      <span className="rounded-full bg-violet-50 px-3 py-1 font-semibold text-violet-700">
                        {toneLabel(item.tone)}
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                      {item.category_name ?? "Tanpa kategori"}
                    </span>
                    {item.is_edited === 1 && <span className="text-slate-400">diedit</span>}
                    <span className="ml-auto text-slate-400">{formatDate(item.created_at)}</span>
                  </div>
                  <div className="truncate text-sm font-semibold text-slate-900" title={item.image_name}>
                    {item.image_name}
                  </div>

                  <textarea
                    rows={Math.min(12, Math.max(4, draft.split("\n").length + 1))}
                    value={draft}
                    onChange={(e) => setDrafts({ ...drafts, [item.id]: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />

                  <div className="flex flex-wrap gap-2 text-xs font-medium">
                    {changed && (
                      <button
                        onClick={() => patch(item, { content: draft })}
                        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700"
                      >
                        <Save size={14} /> Simpan perubahan
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
                      onClick={() => setOpen({ ...open, [item.id]: !open[item.id] })}
                      className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-slate-700 hover:bg-slate-200"
                    >
                      <ChevronDown
                        size={14}
                        className={open[item.id] ? "rotate-180 transition" : "transition"}
                      />
                      Hasil analisis
                    </button>
                    <button
                      onClick={() => patch(item, { is_saved: false })}
                      className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700 hover:bg-slate-200"
                    >
                      Keluarkan dari Library
                    </button>
                    <button
                      onClick={() => remove(item)}
                      className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={14} /> Hapus
                    </button>
                  </div>

                  {open[item.id] && (
                    <dl className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                      {(
                        [
                          ["Deskripsi", item.description],
                          ["Objek / produk", item.objects],
                          ["Warna dominan", item.dominant_colors],
                          ["Teks terbaca", item.visible_text],
                          ["Konteks", item.context],
                        ] as const
                      ).map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {label}
                          </dt>
                          <dd className="text-slate-800">{value || "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}