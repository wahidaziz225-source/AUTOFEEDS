"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, Download, Loader2, Sparkles, Trash2 } from "lucide-react";
import {
  DEFAULT_IMAGE_OPTIONS, type ImageProcessingOptions, type ImageVariant, type ImageCapabilities,
} from "@/lib/image-processing-options";

type Photo = { id: number; name: string };
const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const checker = { backgroundColor: "#fff", backgroundImage: "conic-gradient(#e2e8f0 25%, transparent 0 50%, #e2e8f0 0 75%, transparent 0)", backgroundSize: "24px 24px" };

export default function ImageStudioPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [imageId, setImageId] = useState(0);
  const [options, setOptions] = useState<ImageProcessingOptions>({ ...DEFAULT_IMAGE_OPTIONS });
  const [capabilities, setCapabilities] = useState<ImageCapabilities | null>(null);
  const [variants, setVariants] = useState<ImageVariant[]>([]);
  const [selected, setSelected] = useState<ImageVariant | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const photo = photos.find(p => p.id === imageId);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/images", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Daftar foto gagal dimuat.");
        setPhotos(data.images);
        const requested = Number(new URLSearchParams(window.location.search).get("image_id"));
        setImageId(data.images.some((p: Photo) => p.id === requested) ? requested : data.images[0]?.id ?? 0);
      } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    (async () => {
      try {
        const response = await fetch("/api/image-processing?capabilities=1", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error();
        setCapabilities(data.capabilities);
      } catch { if (!controller.signal.aborted) setCapabilities({ ready: false, reason: "Status AI tidak dapat diperiksa. Pengolahan dasar tetap dapat dicoba.", engine: "U2NETP / CPU" }); }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!imageId) return;
    const controller = new AbortController();
    (async () => {
      setVariantsLoading(true);
      setVariants([]); setSelected(null); setNotice("");
      try {
        const response = await fetch(`/api/image-processing?image_id=${imageId}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Riwayat foto gagal dimuat.");
        setVariants(data.variants); setSelected(data.variants[0] ?? null);
      } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
      finally { if (!controller.signal.aborted) setVariantsLoading(false); }
    })();
    return () => controller.abort();
  }, [imageId]);

  function patch(update: Partial<ImageProcessingOptions>) { setOptions(current => ({ ...current, ...update })); }
  async function processPhoto() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/image-processing", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_id: imageId, options }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Foto gagal diproses.");
      setVariants(current => [data.variant, ...current]); setSelected(data.variant);
      setNotice("Hasil foto tersimpan. Pilih varian ini di Promo Composer untuk menggunakannya.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function removeVariant(variant: ImageVariant) {
    if (!confirm("Hapus hasil olahan ini? Foto asli tetap tersedia.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/image-processing?id=${variant.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menghapus varian.");
      setVariants(current => current.filter(v => v.id !== variant.id));
      if (selected?.id === variant.id) setSelected(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-6xl space-y-6">
    <header>
      <h1 className="text-2xl font-bold text-slate-900">Product Image Studio</h1>
      <p className="mt-1 text-sm text-slate-500">Perbaiki foto dan siapkan produk untuk poster. Foto asli selalu tersedia; setiap hasil disimpan sebagai varian baru.</p>
    </header>
    {error && <div role="alert" className="flex gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"><AlertCircle size={18} className="shrink-0" />{error}</div>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    {loading ? <p className="flex gap-2 text-sm"><Loader2 className="animate-spin" size={18} />Memuat foto…</p> : !photos.length ?
      <div className="rounded-2xl border border-slate-200 bg-white p-8"><p>Belum ada foto produk.</p><Link href="/upload" className="mt-3 inline-block font-semibold text-indigo-600">Unggah foto produk →</Link></div> :
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Pengaturan foto</h2>
          <label className="block text-sm">Foto produk
            <select className={input} value={imageId} disabled={busy} onChange={e => { setSelected(null); setVariants([]); setImageId(Number(e.target.value)); setError(""); setOptions({ ...DEFAULT_IMAGE_OPTIONS }); }}>
              {photos.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Cahaya & detail</legend>
            {([['brightness', 'Pencahayaan', .8, 1.2], ['contrast', 'Kontras', .8, 1.2], ['sharpness', 'Ketajaman', 1, 1.5]] as const).map(([key, label, min, max]) =>
              <label key={key} className="block text-sm">{label} <span className="float-right text-slate-500">{options[key].toFixed(2)}×</span>
                <input aria-label={label} type="range" min={min} max={max} step="0.05" value={options[key]} onChange={e => patch({ [key]: Number(e.target.value) })} className="mt-2 w-full accent-indigo-600" />
              </label>)}
            <label className="block text-sm">Background
              <select className={input} value={options.background} onChange={e => {
                const background = e.target.value as ImageProcessingOptions['background'];
                patch({ background, ...(background === 'original' ? { remove_background: false, shadow: false } : {}) });
              }}>
                <option value="original">Pertahankan background asli</option><option value="transparent">Transparan</option><option value="solid">Warna pilihan</option>
              </select>
            </label>
            {options.background === 'solid' && <label className="flex items-center justify-between text-sm">Warna background<input aria-label="Warna background" type="color" value={options.background_color} onChange={e => patch({ background_color: e.target.value })} /></label>}
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={options.remove_background} disabled={options.background === 'original' || !capabilities?.ready} onChange={e => patch({ remove_background: e.target.checked })} />Hapus background dengan AI lokal</label>
            <p className="text-xs text-slate-500">{capabilities ? capabilities.reason : 'Memeriksa model AI lokal…'} Untuk PNG yang sudah transparan, AI tidak diperlukan.</p>
            <fieldset disabled={options.background === 'original'} className="space-y-3 disabled:opacity-40">
              <legend className="mb-2 text-xs font-semibold text-slate-500">Komposisi produk terisolasi</legend>
              {([['scale', 'Ukuran produk', .4, 1], ['position_x', 'Posisi horizontal', -1, 1], ['position_y', 'Posisi vertikal', -1, 1]] as const).map(([key, label, min, max]) =>
                <label key={key} className="block text-sm">{label}<span className="float-right text-slate-500">{Math.round(options[key] * 100)}%</span>
                  <input aria-label={label} type="range" min={min} max={max} step="0.05" value={options[key]} onChange={e => patch({ [key]: Number(e.target.value) })} className="mt-2 w-full accent-indigo-600" />
                </label>)}
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={options.shadow} onChange={e => patch({ shadow: e.target.checked })} />Tambahkan bayangan lembut</label>
            </fieldset>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy || variantsLoading} onClick={processPhoto} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{busy ? 'Memproses…' : 'Buat hasil foto'}</button>
            <button disabled={busy} onClick={() => setOptions({ ...DEFAULT_IMAGE_OPTIONS })} className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50">Reset</button>
          </div>
          <p className="text-xs text-slate-500">Perubahan pengaturan diterapkan setelah Anda menekan Buat hasil foto. Preview menampilkan varian yang telah tersimpan.</p>
        </section>
        <section className="min-w-0 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <figcaption className="border-b px-4 py-3 text-sm font-semibold">Foto asli</figcaption>
              <div style={checker} className="flex h-80 items-center justify-center p-3"><img src={`/api/image-file?id=${imageId}`} alt={`Foto asli ${photo?.name ?? ''}`} className="max-h-full max-w-full object-contain" /></div>
            </figure>
            <figure aria-busy={busy} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <figcaption className="border-b px-4 py-3 text-sm font-semibold">{selected ? `Hasil tersimpan · #${selected.id}` : 'Hasil foto'}</figcaption>
              <div style={checker} className="flex h-80 items-center justify-center p-3">
                {selected ? <img src={`/api/image-file?id=${imageId}&variant_id=${selected.id}`} alt={`Hasil olahan ${photo?.name ?? ''}`} className="max-h-full max-w-full object-contain" /> : <p className="rounded-lg bg-white/90 p-4 text-center text-sm text-slate-500">{variantsLoading ? 'Memuat riwayat…' : 'Buat hasil foto untuk melihat perbandingan.'}</p>}
              </div>
            </figure>
          </div>
          {selected && <div className="flex flex-wrap items-center gap-3 text-sm">
            <a href={`/api/image-file?id=${imageId}&variant_id=${selected.id}&download=1`} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 font-medium ring-1 ring-slate-200"><Download size={16} />Unduh PNG foto</a>
            <Link href="/promo" className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white">Buka Promo Composer →</Link>
            <button disabled={busy} onClick={() => removeVariant(selected)} className="flex items-center gap-1.5 px-2 py-2 text-rose-600 disabled:opacity-50"><Trash2 size={16} />Hapus varian</button>
          </div>}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Riwayat olahan ({variants.length})</h2>
            <p className="mt-1 text-xs text-slate-500">Periksa tepi kemasan, logo, dan tulisan sebelum menggunakan hasil penghapusan background.</p>
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {variants.map(v => <button key={v.id} disabled={busy} onClick={() => { setSelected(v); setNotice(''); }} aria-pressed={selected?.id === v.id} className={`overflow-hidden rounded-xl border-2 ${selected?.id === v.id ? 'border-indigo-600' : 'border-slate-100'}`}>
                <div style={checker}><img src={`/api/image-file?id=${imageId}&variant_id=${v.id}`} alt={`Varian ${v.id}`} className="h-24 w-full object-contain" /></div>
                <span className="block p-2 text-xs">#{v.id} · {v.width}×{v.height}</span>
              </button>)}
            </div>
            {!variantsLoading && !variants.length && <p className="mt-3 text-sm text-slate-500">Belum ada varian tersimpan untuk foto ini.</p>}
          </div>
        </section>
      </div>}
    <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <summary className="cursor-pointer font-semibold">Pemasangan AI lokal (opsional, satu kali)</summary>
      <p className="mt-3 text-slate-600">Jalankan dari folder proyek menggunakan Python yang sama dengan server:</p>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{'python -m pip install -r requirements-ai.txt\npython scripts/setup_background_model.py'}</pre>
      <p className="mt-2 text-xs text-slate-500">Pemasangan membutuhkan internet. Setelah model terpasang, muat ulang halaman; foto diproses lokal melalui CPU. Pengaturan cahaya tetap bisa digunakan tanpa model AI.</p>
    </details>
  </div>;
}
