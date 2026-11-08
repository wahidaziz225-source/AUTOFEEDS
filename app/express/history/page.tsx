"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, History, Image as ImageIcon, Loader2, X } from "lucide-react";

type Design = {
  id: number;
  title: string;
  headline: string;
  format: string;
  recipe: string;
  created_at: string;
  image_url: string;
  preview_url: string;
  download_url: string;
};

async function fetchHistory(): Promise<Design[]> {
  const response = await fetch("/api/express/history", { cache: "no-store" });
  const data = await response.json() as { designs?: Design[]; error?: string };
  if (!response.ok) throw new Error(data.error || "Riwayat poster gagal dimuat.");
  return data.designs ?? [];
}

export default function ExpressHistoryPage() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Design | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDesigns(await fetchHistory());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Riwayat poster gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    fetchHistory().then((items) => {
      if (!ignore) setDesigns(items);
    }).catch((err: unknown) => {
      if (!ignore) setError(err instanceof Error ? err.message : "Riwayat poster gagal dimuat.");
    }).finally(() => {
      if (!ignore) setLoading(false);
    });
    return () => { ignore = true; };
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/express" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
            <ArrowLeft size={16} /> Kembali ke Express
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
            <History className="text-indigo-600" /> Riwayat Express
          </h1>
          <p className="mt-1 text-sm text-slate-500">Poster Express tersimpan di komputer ini.</p>
        </div>
        <button type="button" onClick={() => void loadHistory()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
          Muat ulang
        </button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center gap-2 rounded-2xl bg-white text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          <Loader2 className="animate-spin" size={18} /> Memuat riwayat poster…
        </div>
      ) : designs.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center">
          <ImageIcon size={36} className="text-slate-300" />
          <h2 className="mt-3 font-bold text-slate-700">Belum ada poster tersimpan</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">Poster yang berhasil dibuat dari Auto Feeds Express akan muncul di sini.</p>
          <Link href="/express" className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">Buat poster</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {designs.map((design) => (
            <article key={design.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <button type="button" onClick={() => setSelected(design)} className="block w-full bg-slate-100 text-left" aria-label={`Buka poster ${design.headline}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={design.preview_url} alt={design.headline} loading="lazy" className="aspect-[4/5] w-full object-contain transition hover:scale-[1.02]" />
              </button>
              <div className="space-y-2 p-3">
                <h2 className="line-clamp-2 text-sm font-bold text-slate-800">{design.headline}</h2>
                <p className="text-xs text-slate-500">{new Date(`${design.created_at.replace(" ", "T")}Z`).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>
                <a href={design.download_url} download className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700">
                  <Download size={14} /> Unduh poster
                </a>
              </div>
            </article>
          ))}
        </div>
      )}

      {selected && (
        <div role="dialog" aria-modal="true" aria-label={`Poster ${selected.headline}`} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setSelected(null)}>
          <div className="relative flex max-h-[94vh] w-full max-w-3xl flex-col items-center" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setSelected(null)} aria-label="Tutup" className="absolute -right-2 -top-2 z-10 rounded-full bg-white p-2 text-slate-700 shadow-lg"><X size={18} /></button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.image_url} alt={selected.headline} className="max-h-[82vh] max-w-full rounded-xl object-contain" />
            <a href={`${selected.download_url}&format=png`} download className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900">
              <Download size={16} /> Unduh PNG
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
