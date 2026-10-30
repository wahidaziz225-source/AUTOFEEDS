"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ScanSearch, AlertCircle } from "lucide-react";

type Img = { id: number; name: string; category_name: string | null };

type Analysis = {
  id: number;
  description: string | null;
  objects: string | null;
  dominant_colors: string | null;
  visible_text: string | null;
  context: string | null;
  model: string | null;
  duration_ms: number | null;
  created_at: string;
};

type Status = {
  job: { status: "running" | "done" | "error"; error?: string; elapsed_ms: number } | null;
  analysis: Analysis | null;
};

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm text-slate-800">{value || "—"}</div>
    </div>
  );
}

export default function AnalyzerPage() {
  const [images, setImages] = useState<Img[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const fetchStatus = useCallback(async (id: number) => {
    const res = await fetch(`/api/analyze?image_id=${id}`, { cache: "no-store" });
    const data = (await res.json()) as Status;
    setStatus(data);
    return data;
  }, []);

  const startPolling = useCallback(
    (id: number) => {
      stopPolling();
      timer.current = setInterval(async () => {
        try {
          const d = await fetchStatus(id);
          if (d.job?.status !== "running") stopPolling();
        } catch {
          /* coba lagi pada putaran berikutnya */
        }
      }, 3000);
    },
    [fetchStatus]
  );

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
    return stopPolling;
  }, []);

  async function select(id: number) {
    setSelected(id);
    setError("");
    setStatus(null);
    stopPolling();
    try {
      const d = await fetchStatus(id);
      if (d.job?.status === "running") startPolling(id);
    } catch {
      setError("Gagal memuat status analisis.");
    }
  }

  async function analyze() {
    if (selected == null) return;
    setStarting(true);
    setError("");
    try {
      const res = await fetch(`/api/analyze?image_id=${selected}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memulai analisis.");
      await fetchStatus(selected);
      startPolling(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memulai analisis.");
    } finally {
      setStarting(false);
    }
  }

  const running = status?.job?.status === "running";
  const jobError = status?.job?.status === "error" ? status.job.error : "";
  const a = status?.analysis ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">AI Image Analyzer</h1>
        <p className="text-sm text-slate-500">
          Pilih gambar, lalu jalankan analisis AI lokal. Di CPU, prosesnya bisa memakan beberapa menit.
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Pilih gambar ({images.length})</h2>
          {images.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada gambar. Unggah dulu di menu Image Upload.</p>
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

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
          {selected == null ? (
            <p className="text-sm text-slate-500">Pilih satu gambar di sebelah kiri.</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row">
                <img
                  src={`/api/image-file?id=${selected}`}
                  alt="Gambar terpilih"
                  className="h-48 w-full rounded-xl object-cover sm:w-64"
                />
                <div className="flex flex-col justify-center gap-3">
                  <button
                    onClick={analyze}
                    disabled={running || starting}
                    className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {running || starting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ScanSearch size={16} />
                    )}
                    {running ? "Menganalisis..." : a ? "Analisis ulang" : "Analyze Image"}
                  </button>
                  {running && status?.job && (
                    <p className="text-xs text-slate-500">
                      Berjalan {Math.round(status.job.elapsed_ms / 1000)} detik. Jangan tutup server.
                    </p>
                  )}
                </div>
              </div>

              {jobError && (
                <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" /> {jobError}
                </div>
              )}

              {a && (
                <div className="space-y-4 rounded-xl bg-slate-50 p-5">
                  <Field label="Deskripsi" value={a.description} />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Objek / Produk" value={a.objects} />
                    <Field label="Warna dominan" value={a.dominant_colors} />
                    <Field label="Teks terbaca" value={a.visible_text} />
                    <Field label="Konteks" value={a.context} />
                  </div>
                  <div className="text-xs text-slate-400">
                    Model {a.model} • {a.duration_ms ? Math.round(a.duration_ms / 1000) : "?"} detik • {a.created_at}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}