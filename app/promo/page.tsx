"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BrandKit } from "@/lib/brand-options";
import type { ImageVariant } from "@/lib/image-processing-options";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Wand2, Download, Trash2, AlertCircle, X, Shuffle } from "lucide-react";
import {
  MAX_PROMO_ITEMS,
  PROMO_FORMATS,
  PROMO_STYLES,
  PROMO_THEMES,
  PROMO_TYPES,
  computeItem,
  formatRupiah,
  parseAmount,
  type PromoParams,
} from "@/lib/promo-options";

type Img = { id: number; name: string };
type Sel = { imageId: number; name: string; price: string; oldPrice: string; variantId: number | null };
type Design = { id: number; title: string; layout_format: string; created_at: string; batch_id: string | null; style: string | null; is_saved: number; can_regenerate: number };

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

export default function PromoPage() {
  const router = useRouter();
  const [brandLoading,setBrandLoading] = useState(true);
  const [brands, setBrands] = useState<BrandKit[]>([]);
  const [brandId, setBrandId] = useState(0);
  const [images, setImages] = useState<Img[]>([]);
  const [variants, setVariants] = useState<Record<number, ImageVariant[]>>({});
  const [sel, setSel] = useState<Sel[]>([]);
  const [type, setType] = useState<string>("harga_spesial");
  const [percent, setPercent] = useState("20");
  const [amount, setAmount] = useState("");
  const [buyQty, setBuyQty] = useState("1");
  const [freeQty, setFreeQty] = useState("1");
  const [bundlePrice, setBundlePrice] = useState("");
  const [title, setTitle] = useState("PROMO SPESIAL");
  const [subtitle, setSubtitle] = useState("");
  const [footer, setFooter] = useState("");
  const [badge, setBadge] = useState("PROMO");
  const [customWidth,setCustomWidth]=useState(1200),[customHeight,setCustomHeight]=useState(900);
  const [format, setFormat] = useState("feed");
  const [style, setStyle] = useState("retail");
  const [theme, setTheme] = useState("acak");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultId, setResultId] = useState<number | null>(null);
  const [count, setCount] = useState(4);
  const [results, setResults] = useState<Design[]>([]);
  const [savedDesigns, setSavedDesigns] = useState<Design[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [notice, setNotice] = useState("");
  const [designs, setDesigns] = useState<Design[]>([]);

  const typeInfo = PROMO_TYPES.find((t) => t.id === type) ?? PROMO_TYPES[0];

  const params: PromoParams = {
    discountPercent: Math.round(Number(percent)),
    discountAmount: parseAmount(amount) ?? 0,
    buyQty: Math.round(Number(buyQty)),
    freeQty: Math.round(Number(freeQty)),
    bundlePrice,
  };

  const loadDesigns = useCallback(async () => {
    try {
      const [res, savedRes] = await Promise.all([
        fetch("/api/promo", { cache: "no-store" }), fetch("/api/promo?saved=1", { cache: "no-store" }),
      ]);
      const [data, savedData] = await Promise.all([res.json(), savedRes.json()]);
      if (!res.ok || !savedRes.ok) throw new Error("Gagal memuat riwayat desain.");
      setDesigns(data.designs ?? []); setSavedDesigns(savedData.designs ?? []);
    } catch {
      setError("Gagal memuat riwayat desain. Muat ulang halaman untuk mencoba lagi.");
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
      try {
        const response = await fetch('/api/brand-kits', {cache:'no-store'}), data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal memuat Brand Kit.');
        setBrands(data.kits);const kit = data.kits.find((k:BrandKit)=>k.is_default);
        if(kit){setBrandId(kit.id);setFormat(kit.promo_format);setStyle(kit.promo_style);setTitle(kit.promo_title);setBadge(kit.promo_badge);setFooter(kit.footer_text);}
      } catch(e) { setError((e as Error).message); }
      await loadDesigns();
      setBrandLoading(false);
    })();
  }, [loadDesigns]);

  function changeType(next: string) {
    setType(next);
    setError("");
    const defaults = PROMO_TYPES.map((t) => t.defaultTitle as string);
    if (defaults.includes(title)) {
      setTitle(PROMO_TYPES.find((t) => t.id === next)?.defaultTitle ?? title);
    }
  }

  async function toggle(img: Img) {
    setError("");
    if (sel.some((s) => s.imageId === img.id)) {
      setSel(sel.filter((s) => s.imageId !== img.id));
    } else if (sel.length >= MAX_PROMO_ITEMS) {
      setError(`Maksimal ${MAX_PROMO_ITEMS} produk per desain.`);
    } else {
      setSel([...sel, { imageId: img.id, name: img.name, price: "", oldPrice: "", variantId: null }]);
      try {
        const res = await fetch(`/api/image-processing?image_id=${img.id}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal memuat varian foto.");
        setVariants(current => ({ ...current, [img.id]: data.variants }));
      } catch (e) { setError((e as Error).message); }
    }
  }

  function patch(imageId: number, p: Partial<Sel>) {
    setSel(sel.map((s) => (s.imageId === imageId ? { ...s, ...p } : s)));
  }

  function preview(s: Sel): string {
    if (type === "bundling" || !s.price.trim()) return "";
    const c = computeItem(type, params, s.price, s.oldPrice);
    if (!c.ok) return c.error;
    return `${c.oldText ? c.oldText + " → " : ""}${c.priceText}${c.tag ? "  (" + c.tag + ")" : ""}`;
  }

  async function generate() {
    setError(""); setNotice("");
    if (sel.length === 0) return setError("Pilih minimal 1 gambar.");
    if (type === "bundling") {
      if (sel.length < 2) return setError("Paket bundling butuh minimal 2 produk.");
      if (!parseAmount(bundlePrice)) return setError("Isi harga paket (angka).");
    } else {
      const missing = sel.find((s) => !s.price.trim());
      if (missing) return setError(`Harga untuk "${missing.name}" belum diisi.`);
    }

    setBusy(true);
    try {
      const res = await fetch("/api/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count,
          brand_kit_id: brandId,
          promo_type: type,
          discount_percent: percent,
          discount_amount: amount,
          buy_qty: buyQty,
          free_qty: freeQty,
          bundle_price: bundlePrice,
          title,
          subtitle,
          footer,
          badge,
          format,
          ...(format==="custom"?{width:customWidth,height:customHeight}:{}),
          theme,
          style,
          items: sel.map((s) => ({
            image_id: s.imageId,
            variant_id: s.variantId,
            name: s.name,
            price: s.price,
            old_price: s.oldPrice,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat desain.");
      setResultId(data.id);
      setResults(data.designs ?? []);
      setNotice(`${data.designs?.length ?? 1} desain berhasil dibuat dan masuk riwayat. Tandai hasil terbaik sebagai pilihan.`);
      await loadDesigns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat desain.");
    } finally {
      setBusy(false);
    }
  }

  async function openDesign(design: Design) {
    setResultId(design.id); setError(""); setNotice("");
    if (!design.batch_id) { setResults([design]); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/promo?batch_id=${encodeURIComponent(design.batch_id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal membuka kelompok desain.");
      setResults(data.designs);
    } catch (e) { setResults([design]); setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function generateFromSaved(more: boolean) {
    if (!resultId || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/promo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(more ? { source_id: resultId, count: count === 1 ? 4 : count } : { regenerate_id: resultId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal membuat variasi.");
      if (more) setResults(data.designs);
      else setResults(current => [...current, ...data.designs]);
      setResultId(data.id);
      setNotice(more ? "Kelompok variasi baru dibuat dari pengaturan desain terpilih." : "Desain baru dibuat. Hasil sebelumnya tetap tersedia.");
      await loadDesigns();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function saveDesign(design: Design) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/promo", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: design.id, is_saved: !design.is_saved }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan pilihan.");
      setResults(current => current.map(d => d.id === design.id ? { ...d, is_saved: design.is_saved ? 0 : 1 } : d));
      setNotice(design.is_saved ? "Tanda pilihan dilepas; desain tetap tersimpan di riwayat." : "Desain ditandai sebagai pilihan.");
      await loadDesigns();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function editDesign() {
    if (!resultId || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/designs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promo_id: resultId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal membuka editor.");
      router.push(`/editor?id=${data.id}`);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  async function removeDesign(id: number) {
    if (!confirm("Hapus desain ini?")) return;
    try {
      const res = await fetch(`/api/promo?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menghapus.");
      const remaining = results.filter(d => d.id !== id);
      if (resultId === id) setResultId(remaining[0]?.id ?? null);
      setResults(remaining);
      await loadDesigns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  const normalTotal = (() => {
    const vals = sel.map((s) => parseAmount(s.price));
    return vals.length > 0 && vals.every((v) => v) ? (vals as number[]).reduce((a, b) => a + b, 0) : null;
  })();

  const selectedDesign = results.find(d => d.id === resultId) ?? designs.find(d => d.id === resultId) ?? savedDesigns.find(d => d.id === resultId);
  const history = savedOnly ? savedDesigns : designs;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Promo Composer</h1>
        <p className="text-sm text-slate-500">
          Buat 4–6 alternatif komposisi, bandingkan hasil, lalu simpan desain pilihan. Nama, harga, dan foto produk tetap mengikuti data yang Anda berikan.
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
      <fieldset disabled={busy||brandLoading} className="min-w-0 border-0 p-0">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            2. Pilih produk ({sel.length}/{MAX_PROMO_ITEMS})
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
                      src={`/api/image-file?id=${img.id}&size=small`}
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
            <h2 className="text-sm font-semibold text-slate-900">1. Jenis promo</h2>
            <div className="flex flex-wrap gap-2">
              {PROMO_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => changeType(t.id)}
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
            <p className="text-xs text-slate-500">{typeInfo.hint}</p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {type === "diskon_persen" && (
                <label className="text-xs font-medium text-slate-500">
                  Diskon (%) *
                  <input
                    value={percent}
                    inputMode="numeric"
                    onChange={(e) => setPercent(e.target.value)}
                    className={inputCls}
                  />
                </label>
              )}
              {type === "potongan_rp" && (
                <label className="text-xs font-medium text-slate-500">
                  Potongan (Rp) *
                  <input
                    value={amount}
                    inputMode="numeric"
                    placeholder="5000"
                    onChange={(e) => setAmount(e.target.value)}
                    className={inputCls}
                  />
                </label>
              )}
              {type === "beli_gratis" && (
                <>
                  <label className="text-xs font-medium text-slate-500">
                    Beli (jumlah) *
                    <input
                      value={buyQty}
                      inputMode="numeric"
                      onChange={(e) => setBuyQty(e.target.value)}
                      className={inputCls}
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-500">
                    Gratis (jumlah) *
                    <input
                      value={freeQty}
                      inputMode="numeric"
                      onChange={(e) => setFreeQty(e.target.value)}
                      className={inputCls}
                    />
                  </label>
                </>
              )}
              {type === "bundling" && (
                <label className="text-xs font-medium text-slate-500">
                  Harga paket *
                  <input
                    value={bundlePrice}
                    inputMode="numeric"
                    placeholder="75000"
                    onChange={(e) => setBundlePrice(e.target.value)}
                    className={inputCls}
                  />
                </label>
              )}
            </div>
            {type === "bundling" && normalTotal != null && parseAmount(bundlePrice) && (
              <p className="text-xs text-emerald-700">
                Total normal {formatRupiah(normalTotal)}. Hemat{" "}
                {formatRupiah(Math.max(0, normalTotal - (parseAmount(bundlePrice) ?? 0)))}.
              </p>
            )}
          </div>

          <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">3. Nama dan harga tiap produk</h2>
            {sel.length === 0 ? (
              <p className="text-sm text-slate-500">Klik gambar di sebelah kiri untuk memilih produk.</p>
            ) : (
              <ul className="space-y-3">
                {sel.map((s, i) => {
                  const pv = preview(s);
                  return (
                    <li key={s.imageId} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                      <img
                        src={`/api/image-file?id=${s.imageId}${s.variantId ? `&variant_id=${s.variantId}` : ""}`}
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
                          {typeInfo.priceLabel}
                          <input
                            value={s.price}
                            maxLength={30}
                            placeholder="25000"
                            onChange={(e) => patch(s.imageId, { price: e.target.value })}
                            className={inputCls}
                          />
                        </label>
                        {type === "harga_spesial" && (
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
                        )}
                        <label className="text-xs font-medium text-slate-500 sm:col-span-3">
                          Foto untuk poster
                          <select value={s.variantId ?? ""} className={inputCls} onChange={e => patch(s.imageId, { variantId: e.target.value ? Number(e.target.value) : null })}>
                            <option value="">Foto asli</option>
                            {(variants[s.imageId] ?? []).map(v => <option key={v.id} value={v.id}>Hasil olahan #{v.id} · {v.width}×{v.height}</option>)}
                          </select>
                          <Link href={`/image-studio?image_id=${s.imageId}`} className="mt-1 inline-block text-indigo-600">Olah foto / buat background →</Link>
                        </label>
                        {pv && <div className="text-xs font-medium text-indigo-700 sm:col-span-3">{pv}</div>}
                      </div>
                      <button
                        onClick={() => setSel(sel.filter((x) => x.imageId !== s.imageId))}
                        title="Hapus dari desain"
                        className="h-8 w-8 shrink-0 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                      >
                        <X size={16} className="mx-auto" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-xs text-slate-400">
              Angka saja otomatis jadi format rupiah (25000 menjadi Rp25.000). Hasil diskon persen dibulatkan ke rupiah terdekat.
            </p>
          </div>

          <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">4. Teks dan tampilan</h2>
            <label className="block text-sm">Brand Kit
              <select aria-label="Brand Kit" value={brandId} onChange={e=>{
                const id=Number(e.target.value);setBrandId(id);const kit=brands.find(k=>k.id===id);
                if(kit){setFooter(kit.footer_text);setStyle(kit.promo_style);setFormat(kit.promo_format);setTitle(kit.promo_title);setBadge(kit.promo_badge);}
              }} className={inputCls}><option value={0}>Tanpa Brand Kit</option>{brands.map(k=><option key={k.id} value={k.id}>{k.name}{k.is_default?' (default)':''}</option>)}</select>
            </label>
            {brandId>0&&<p className="text-xs text-slate-500">Warna, font, dan logo diambil dari Brand Kit. Judul, footer, konsep, dan ukuran masih bisa Anda ubah untuk promo ini.</p>}

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-slate-500">Konsep desain</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PROMO_STYLES.map((s) => (
                  <button key={s.id} type="button" aria-pressed={style === s.id}
                    onClick={() => setStyle(s.id)}
                    className={`rounded-xl border p-3 text-left ${style === s.id ? "border-indigo-600 bg-indigo-50" : "border-slate-200"}`}>
                    <span className="block text-sm font-semibold">{s.label}</span>
                    <span className="text-xs text-slate-500">{s.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>
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
                <select aria-label="Ukuran" value={format} onChange={(e) => setFormat(e.target.value)} className={inputCls}>
                  {PROMO_FORMATS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              {format==='custom'&&<div className="grid grid-cols-2 gap-2"><label className="text-xs">Lebar (px)<input aria-label="Lebar poster khusus" type="number" min="512" max="4096" value={customWidth} onChange={e=>setCustomWidth(Number(e.target.value))} className={inputCls}/></label><label className="text-xs">Tinggi (px)<input aria-label="Tinggi poster khusus" type="number" min="512" max="4096" value={customHeight} onChange={e=>setCustomHeight(Number(e.target.value))} className={inputCls}/></label><p className="text-xs text-slate-500 col-span-2">512–4096 px per sisi; rasio 1:3 sampai 3:1.</p></div>}
              <div>
                <div className="text-xs font-medium text-slate-500">Warna tema</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PROMO_THEMES.map((t) => (
                    <button
                      key={t.id}
                      title={t.label}
                      disabled={brandId>0}
                      onClick={() => setTheme(t.id)}
                      style={{ background: t.bg }}
                      className={`h-9 w-9 rounded-full ring-2 ring-offset-2 transition ${
                        theme === t.id ? "ring-slate-900" : "ring-transparent"
                      }`}
                    />
                  ))}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {PROMO_THEMES.find((t) => t.id === theme)?.label}
                </div>
              </div>
            </div>
            <label className="block text-sm font-medium text-slate-700">Jumlah desain
              <select value={count} onChange={e => setCount(Number(e.target.value))} className={inputCls}>
                <option value={1}>1 desain (konsep terpilih)</option>
                <option value={4}>4 variasi</option><option value={5}>5 variasi</option><option value={6}>6 variasi</option>
              </select>
            </label>
            <p className="text-xs text-slate-500">Konsep terpilih menjadi desain pertama; variasi lain memakai konsep berbeda. Proses dijalankan berurutan dan dapat memerlukan waktu lebih lama untuk beberapa produk.</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={generate}
                disabled={busy}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {busy ? "Menyusun desain…" : count === 1 ? "Buat visual promo" : `Buat ${count} variasi desain`}
              </button>

            </div>
          </div>

          {resultId != null && (
            <div className="space-y-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Hasil terpilih #{resultId}</h2>
              {results.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {results.map(d => <button type="button" key={d.id} onClick={() => setResultId(d.id)} aria-pressed={resultId === d.id}
                  className={`overflow-hidden rounded-xl border-2 text-left ${resultId === d.id ? "border-indigo-600" : "border-slate-200"}`}>
                  <img src={`/api/promo-file?id=${d.id}`} alt={`Alternatif ${d.id}`} className="h-40 w-full bg-slate-50 object-contain" />
                  <span className="block p-2 text-xs font-medium">{PROMO_STYLES.find(s => s.id === d.style)?.label ?? "Desain lama"}{d.is_saved ? " ★" : ""}</span>
                </button>)}
              </div>}
              <p className="text-xs text-slate-500">Klik alternatif untuk membandingkan. Membuat ulang atau variasi tambahan menggunakan pengaturan tersimpan, termasuk pilihan foto olahan.</p>
              <img
                src={`/api/promo-file?id=${resultId}`}
                alt="Hasil desain promo"
                className="mx-auto max-h-[40rem] w-auto rounded-xl ring-1 ring-slate-200"
              />
              <div className="flex flex-wrap gap-2 text-sm font-medium">
                {selectedDesign && <button onClick={() => saveDesign(selectedDesign)} className="rounded-lg border border-indigo-200 px-4 py-2 text-indigo-700">{selectedDesign.is_saved ? "Lepas tanda pilihan" : "Simpan desain pilihan"}</button>}
                {selectedDesign?.can_regenerate === 1 && <>
                  <button onClick={editDesign} className="rounded-lg bg-indigo-600 px-4 py-2 text-white">Edit desain (salinan)</button>
                  <button onClick={() => generateFromSaved(false)} className="rounded-lg bg-slate-100 px-4 py-2 text-slate-700">Buat ulang desain terpilih</button>
                  <button onClick={() => generateFromSaved(true)} className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-slate-700"><Shuffle size={16} />Buat variasi tambahan</button>
                </>}
                <a
                  href={`/api/promo-file?id=${resultId}&download=1`}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                >
                  <Download size={16} /> Unduh JPG
                </a>
                <a href={`/api/promo-file?id=${resultId}&format=png&download=1`} className="flex items-center gap-2 rounded-lg border border-indigo-200 px-4 py-2 text-indigo-700"><Download size={16}/>Unduh PNG</a>
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

      </fieldset>

      {designs.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Riwayat desain ({history.length})</h2>
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={savedOnly} onChange={e => setSavedOnly(e.target.checked)} />Hanya desain pilihan</label>
          </div>
          {savedOnly && !history.length && <p className="mb-4 text-sm text-slate-500">Belum ada desain yang ditandai sebagai pilihan.</p>}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-6">
            {history.map((d) => (
              <button
                key={d.id}
                disabled={busy}
                onClick={() => openDesign(d)}
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