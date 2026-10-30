"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { Loader2, Wand2, Download, Trash2, AlertCircle, X } from "lucide-react";
import { MAX_PROMO_ITEMS, PROMO_FORMATS, PROMO_THEMES } from "@/lib/promo-options";

type Img = { id: number; name: string };
type Sel = { imageId: number; name: string; price: string; oldPrice: string };
type Design = { id: number; title: string; layout_format: string; created_at: string };

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

export default function PromoPage() {
  const [images, setImages] = useState<Img[]>([]);
  const [sel, setSel] = useState<Sel[]>([]);
  const [title, setTitle] = useState("PROMO SPESIAL");
  const [subtitle, setSubtitle] = useState("");
  const [footer, setFooter] = useState("");
  const [badge, setBadge] = useState("PROMO");
  const [format, setFormat] = useState("feed");
  const [theme, setTheme] = useState("merah");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultId, setResultId] = useState<number | null>(null);
  const [designs, setDesigns] = useState<Design[]>([]);

  const loadDesigns = useCallback(async () => {
    try {
      const res = await fetch("/api/promo", { cache: "no-store" });
      const data = await res.json();
      setDesigns(data.designs ?? []);
    } catch {
      /* riwayat desain opsional */
    }
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
      await loadDesigns();
    })();
  }, [loadDesigns]);

  function toggle(img: Img) {
    setError("");
    if (sel.some((s) => s.imageId === img.id)) {
      setSel(sel.filter((s) => s.imageId !== img.id));
    } else if (sel.length >= MAX_PROMO_ITEMS) {
      setError(`Maksimal ${MAX_PROMO_ITEMS} produk per desain.`);
    } else {
      setSel([...sel, { imageId: img.id, name: img.name, price: "", oldPrice: "" }]);
    }
  }

  function patch(imageId: number, p: Partial<Sel>) {
    setSel(sel.map((s) => (s.imageId === imageId ? { ...s, ...p } : s)));
  }

  async function generate() {
    setError("");
    if (sel.length === 0) return setError("Pilih minimal 1 gambar.");
    const missing = sel.find((s) => !s.price.trim());
    if (missing) return setError(`Harga untuk "${missing.name}" belum diisi.`);

    setBusy(true);
    try {
      const res = await fetch("/api/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subtitle,
          footer,
          badge,
          format,
          theme,
          items: sel.map((s) => ({
            image_id: s.imageId,
            name: s.name,
            price: s.price,
            old_price: s.oldPrice,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat desain.");
      setResultId(data.id);
      await loadDesigns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat desain.");
    } finally {
      setBusy(false);
    }
  }

  async function removeDesign(id: number) {
    if (!confirm("Hapus desain ini?")) return;
    try {
      const res = await fetch(`/api/promo?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menghapus.");
      if (resultId === id) setResultId(null);
      await loadDesigns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Promo Composer</h1>
        <p className="text-sm text-slate-500">
          Pilih sampai {MAX_PROMO_ITEMS} produk, isi harga, lalu hasilkan satu visual promo siap upload.
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            1. Pilih produk ({sel.length}/{MAX_PROMO_ITEMS})
          </h2>
          {images.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada gambar. Unggah dulu di Image Upload.</p>
          ) : (
            <div className="grid max-h-[32rem] grid-cols-2 gap-3 overflow-y-auto">
              {images.map((img) => {
                const order = sel.findIndex((s) => s.imageId === img.id);
                return (
                  <button
                    key={img.id}
                    onClick={() => toggle(img)}
                    className={`relative overflow-hidden rounded-xl text-left ring-2 transition ${
                      order >= 0 ? "ring-indigo-500" : "ring-transparent hover:ring-slate-300"
                    }`}
                  >
                    <img
                      src={`/api/image-file?id=${img.id}`}
                      alt={img.name}
                      loading="lazy"
                      className="h-24 w-full object-cover"
                    />
                    {order >= 0 && (
                      <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                        {order + 1}
                      </span>
                    )}
                    <div className="truncate bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700">
                      {img.name}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-5 lg:col-span-2">
          <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">2. Nama dan harga tiap produk</h2>
            {sel.length === 0 ? (
              <p className="text-sm text-slate-500">Klik gambar di sebelah kiri untuk memilih produk.</p>
            ) : (
              <ul className="space-y-3">
                {sel.map((s, i) => (
                  <li key={s.imageId} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                    <img
                      src={`/api/image-file?id=${s.imageId}`}
                      alt={s.name}
                      className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    />
                    <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                      <label className="text-xs font-medium text-slate-500">
                        {i + 1}. Nama di desain
                        <input
                          value={s.name}
                          maxLength={60}
                          onChange={(e) => patch(s.imageId, { name: e.target.value })}
                          className={inputCls}
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-500">
                        Harga promo *
                        <input
                          value={s.price}
                          maxLength={30}
                          placeholder="25000"
                          onChange={(e) => patch(s.imageId, { price: e.target.value })}
                          className={inputCls}
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-500">
                        Harga coret (opsional)
                        <input
                          value={s.oldPrice}
                          maxLength={30}
                          placeholder="30000"
                          onChange={(e) => patch(s.imageId, { oldPrice: e.target.value })}
                          className={inputCls}
                        />
                      </label>
                    </div>
                    <button
                      onClick={() => setSel(sel.filter((x) => x.imageId !== s.imageId))}
                      title="Hapus dari desain"
                      className="h-8 w-8 shrink-0 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    >
                      <X size={16} className="mx-auto" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-slate-400">
              Angka saja otomatis jadi format rupiah (25000 menjadi Rp25.000). Teks lain, misalnya &quot;Rp25rb&quot;, ditampilkan apa adanya.
            </p>
          </div>

          <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">3. Teks dan tampilan</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-500">
                Judul
                <input value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
              </label>
              <label className="text-xs font-medium text-slate-500">
                Sub judul (opsional)
                <input
                  value={subtitle}
                  maxLength={80}
                  placeholder="Berlaku sampai 31 Oktober"
                  onChange={(e) => setSubtitle(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="text-xs font-medium text-slate-500">
                Teks bawah / kontak (opsional)
                <input
                  value={footer}
                  maxLength={80}
                  placeholder="Pesan via WhatsApp 08xx"
                  onChange={(e) => setFooter(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="text-xs font-medium text-slate-500">
                Label di tiap produk (kosongkan jika tidak perlu)
                <input value={badge} maxLength={16} onChange={(e) => setBadge(e.target.value)} className={inputCls} />
              </label>
              <label className="text-xs font-medium text-slate-500">
                Ukuran
                <select value={format} onChange={(e) => setFormat(e.target.value)} className={inputCls}>
                  {PROMO_FORMATS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <div className="text-xs font-medium text-slate-500">Warna tema</div>
                <div className="mt-2 flex gap-2">
                  {PROMO_THEMES.map((t) => (
                    <button
                      key={t.id}
                      title={t.label}
                      onClick={() => setTheme(t.id)}
                      style={{ backgroundColor: t.hex }}
                      className={`h-9 w-9 rounded-full ring-2 ring-offset-2 transition ${
                        theme === t.id ? "ring-slate-900" : "ring-transparent"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={generate}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              {busy ? "Menyusun desain..." : "Buat visual promo"}
            </button>
          </div>

          {resultId != null && (
            <div className="space-y-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Hasil</h2>
              <img
                src={`/api/promo-file?id=${resultId}`}
                alt="Hasil desain promo"
                className="mx-auto max-h-[40rem] w-auto rounded-xl ring-1 ring-slate-200"
              />
              <div className="flex gap-2 text-sm font-medium">
                <a
                  href={`/api/promo-file?id=${resultId}&download=1`}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                >
                  <Download size={16} /> Unduh JPG
                </a>
                <button
                  onClick={() => removeDesign(resultId)}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={16} /> Hapus
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {designs.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Desain sebelumnya ({designs.length})</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-6">
            {designs.map((d) => (
              <button
                key={d.id}
                onClick={() => setResultId(d.id)}
                className="overflow-hidden rounded-xl bg-white text-left shadow-sm ring-1 ring-slate-200 hover:ring-indigo-400"
              >
                <img
                  src={`/api/promo-file?id=${d.id}`}
                  alt={d.title}
                  loading="lazy"
                  className="h-32 w-full object-cover"
                />
                <div className="truncate px-2 py-1.5 text-xs font-medium text-slate-700">{d.title}</div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}