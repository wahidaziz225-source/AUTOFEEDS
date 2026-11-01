"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Zap,
  Sparkles,
  Download,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Upload,
  Image as ImageIcon,
  Tag,
  Flame,
  CheckCircle2,
  AlertCircle,
  PenTool,
} from "lucide-react";
import { PROMO_THEMES, PROMO_FORMATS, PROMO_TYPES } from "@/lib/promo-options";

type Img = { id: number; name: string };
type Variant = { id: number; stored_filename: string; width: number; height: number };

type ExpressResult = {
  design: {
    id: number;
    title: string;
    format: string;
    theme: string;
    image_url: string;
    download_url: string;
  };
  caption: {
    id: number | null;
    text: string;
  };
};

const inputCls =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

export default function ExpressPage() {
  const [images, setImages] = useState<Img[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);

  // Form fields
  const [productName, setProductName] = useState("");
  const [promoType, setPromoType] = useState("harga_spesial");
  const [price, setPrice] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState("25");
  const [discountAmount, setDiscountAmount] = useState("");
  const [buyQty, setBuyQty] = useState("1");
  const [freeQty, setFreeQty] = useState("1");
  const [freeProductImgId, setFreeProductImgId] = useState<number | null>(null);
  const [freeProductName, setFreeProductName] = useState("");

  const [benefits, setBenefits] = useState("");
  const [title, setTitle] = useState("PROMO SPESIAL");
  const [subtitle, setSubtitle] = useState("Penawaran Terbatas • Jangan Sampai Kehabisan");
  const [footer, setFooter] = useState("Pesan Sekarang via WhatsApp / Link di Bio");
  const [theme, setTheme] = useState("midnight");
  const [format, setFormat] = useState("feed");

  // State
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ExpressResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/images", { cache: "no-store" });
        const data = await res.json();
        const list = data.images ?? [];
        setImages(list);
        if (list.length > 0) {
          selectProduct(list[0]);
        }
      } catch {
        setError("Gagal memuat galeri produk.");
      } finally {
        setLoadingImages(false);
      }
    }
    load();
  }, []);

  async function selectProduct(img: Img) {
    setSelectedImageId(img.id);
    setProductName(img.name);
    setSelectedVariantId(null);
    try {
      const res = await fetch(`/api/image-processing?image_id=${img.id}`);
      const data = await res.json();
      if (res.ok) setVariants(data.variants ?? []);
    } catch {
      setVariants([]);
    }
  }

  async function handleGenerate() {
    if (!selectedImageId) {
      setError("Pilih produk terlebih dahulu.");
      return;
    }
    if (!price.trim()) {
      setError("Isi harga promo produk.");
      return;
    }

    setError("");
    setGenerating(true);

    try {
      const res = await fetch("/api/express", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_id: selectedImageId,
          variant_id: selectedVariantId,
          name: productName,
          promo_type: promoType,
          price,
          old_price: oldPrice,
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          buy_qty: buyQty,
          free_qty: freeQty,
          ...(promoType === "beli_gratis" && freeProductImgId
            ? {
                free_product: {
                  image_id: freeProductImgId,
                  name: freeProductName,
                },
              }
            : {}),
          format,
          theme,
          title,
          subtitle,
          footer,
          benefits,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat konten.");
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function copyCaption() {
    if (!result?.caption.text) return;
    navigator.clipboard.writeText(result.caption.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Top Banner Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 p-8 text-white shadow-xl ring-1 ring-white/10 sm:p-10">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-sm">
            <Zap size={14} className="fill-slate-950" />
            Alur Cepat Otomatis
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Auto Feeds Express
          </h1>
          <p className="text-base text-slate-300 sm:text-lg">
            <strong>Isi produk → Generate → Siap Upload.</strong> Hasilkan poster promosi visual resolusi tinggi dan caption Instagram persuasif lengkap dengan hashtag dalam hitungan detik.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-medium text-slate-300">
            <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 font-bold text-white">1</span>
              Isi Produk & Promo
            </div>
            <span className="text-slate-500">→</span>
            <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 font-bold text-white">2</span>
              Generate Sekali Klik
            </div>
            <span className="text-slate-500">→</span>
            <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 font-bold text-white">3</span>
              Siap Upload (Poster + Caption)
            </div>
          </div>
        </div>

        {/* Ambient Glow Graphic */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-40 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle size={20} className="shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Input Form (Left) vs Output Preview (Right) */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* LEFT COLUMN: Input Form */}
        <div className="space-y-6 lg:col-span-5">
          {/* 1. Pilih Produk */}
          <div className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-xs font-black text-indigo-600">1</span>
                Pilih Produk
              </h2>
              <Link
                href="/upload"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                <Upload size={14} /> Upload Baru
              </Link>
            </div>

            {loadingImages ? (
              <div className="py-8 text-center text-xs text-slate-400">Memuat produk...</div>
            ) : images.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                <p className="text-xs text-slate-500">Belum ada foto produk yang diunggah.</p>
                <Link
                  href="/upload"
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
                >
                  <Upload size={14} /> Unggah Foto Pertama
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {images.map((img) => {
                    const isSelected = selectedImageId === img.id;
                    return (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => selectProduct(img)}
                        className={`group relative aspect-square overflow-hidden rounded-xl border-2 transition ${
                          isSelected
                            ? "border-indigo-600 ring-2 ring-indigo-500/20"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <img
                          src={`/api/image-file?id=${img.id}&size=small`}
                          alt={img.name}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                          loading="lazy"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-indigo-900/30">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
                              <Check size={12} strokeWidth={3} />
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Image Detail & Variant */}
                {selectedImageId && (
                  <div className="rounded-2xl bg-slate-50 p-3 text-xs">
                    <label className="font-semibold text-slate-700">Foto untuk Poster:</label>
                    <select
                      value={selectedVariantId ?? ""}
                      onChange={(e) => setSelectedVariantId(e.target.value ? Number(e.target.value) : null)}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                    >
                      <option value="">Foto Asli</option>
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          Hasil Olahan Image Studio #{v.id} ({v.width}×{v.height})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Detail Penawaran & Promo */}
          <div className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-xs font-black text-indigo-600">2</span>
              Detail Produk & Promo
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Nama Produk *</label>
                <input
                  type="text"
                  value={productName}
                  maxLength={60}
                  placeholder="Contoh: Belfoods Chicken Nugget 500g"
                  onChange={(e) => setProductName(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Jenis Promo</label>
                <select
                  value={promoType}
                  onChange={(e) => setPromoType(e.target.value)}
                  className={inputCls}
                >
                  <option value="harga_spesial">Harga Spesial (Promo & Coret)</option>
                  <option value="diskon_persen">Diskon Persen (%)</option>
                  <option value="beli_gratis">Beli X Gratis Y</option>
                  <option value="potongan_rp">Potongan Rupiah (Rp)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    {promoType === "diskon_persen" || promoType === "potongan_rp"
                      ? "Harga Normal *"
                      : "Harga Promo *"}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={price}
                    placeholder="25000"
                    onChange={(e) => setPrice(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    {promoType === "diskon_persen"
                      ? "Diskon (%)"
                      : promoType === "potongan_rp"
                      ? "Potongan (Rp)"
                      : "Harga Normal / Coret (opsional)"}
                  </label>
                  {promoType === "diskon_persen" ? (
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      className={inputCls}
                    />
                  ) : promoType === "potongan_rp" ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      value={discountAmount}
                      placeholder="10000"
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      className={inputCls}
                    />
                  ) : (
                    <input
                      type="text"
                      inputMode="numeric"
                      value={oldPrice}
                      placeholder="35000"
                      onChange={(e) => setOldPrice(e.target.value)}
                      className={inputCls}
                    />
                  )}
                </div>
              </div>

              {promoType === "beli_gratis" && (
                <div className="space-y-3 rounded-2xl bg-indigo-50/60 p-3.5 ring-1 ring-indigo-100">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-indigo-900">Beli (Jumlah)</label>
                      <input
                        type="number"
                        min={1}
                        value={buyQty}
                        onChange={(e) => setBuyQty(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-indigo-900">Gratis (Jumlah)</label>
                      <input
                        type="number"
                        min={1}
                        value={freeQty}
                        onChange={(e) => setFreeQty(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-indigo-900">Produk Gratis (Opsional)</label>
                    <select
                      value={freeProductImgId ?? ""}
                      onChange={(e) => {
                        const id = e.target.value ? Number(e.target.value) : null;
                        setFreeProductImgId(id);
                        if (id) {
                          const f = images.find((i) => i.id === id);
                          if (f) setFreeProductName(f.name);
                        } else {
                          setFreeProductName("");
                        }
                      }}
                      className={inputCls}
                    >
                      <option value="">Sama dengan produk utama</option>
                      {images.map((img) => (
                        <option key={img.id} value={img.id}>
                          {img.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {freeProductImgId && (
                    <div>
                      <label className="text-xs font-semibold text-indigo-900">Nama Produk Gratis</label>
                      <input
                        type="text"
                        value={freeProductName}
                        onChange={(e) => setFreeProductName(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Keunggulan / Manfaat Produk (opsional)
                </label>
                <textarea
                  rows={2}
                  value={benefits}
                  maxLength={500}
                  placeholder="Contoh: 100% daging sapi pilihan, renyah dan gurih, praktis untuk bekal anak"
                  onChange={(e) => setBenefits(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* 3. Gaya Tampilan & Format */}
          <div className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-xs font-black text-indigo-600">3</span>
              Gaya Desain & Tema
            </h2>

            <div>
              <label className="text-xs font-semibold text-slate-700">Warna Tema Desain</label>
              <div className="mt-2 flex flex-wrap gap-2.5">
                {PROMO_THEMES.filter((t) => t.id !== "acak").map((t) => {
                  const isSelected = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      title={t.label}
                      onClick={() => setTheme(t.id)}
                      style={{ background: t.bg }}
                      className={`h-9 w-9 rounded-full ring-2 ring-offset-2 transition ${
                        isSelected ? "scale-110 ring-slate-900 shadow-md" : "ring-transparent hover:scale-105"
                      }`}
                    />
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-slate-500 font-medium">
                Pilihan tema: {PROMO_THEMES.find((t) => t.id === theme)?.label}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Format Poster</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className={inputCls}
                >
                  <option value="feed">Feed Instagram (4:5)</option>
                  <option value="square">Persegi (1:1)</option>
                  <option value="story">Story / Reels (9:16)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Judul Header</label>
                <input
                  type="text"
                  value={title}
                  maxLength={40}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Info Kontak / CTA Bawah</label>
              <input
                type="text"
                value={footer}
                maxLength={80}
                placeholder="Pesan Sekarang via WhatsApp 08xx / Link di Bio"
                onChange={(e) => setFooter(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Action Generate Button */}
          <button
            type="button"
            disabled={generating}
            onClick={handleGenerate}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 py-4 text-base font-extrabold text-white shadow-lg shadow-indigo-600/25 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
          >
            {generating ? (
              <>
                <RefreshCw size={20} className="animate-spin" />
                <span>Menghasilkan Feeds & Caption...</span>
              </>
            ) : (
              <>
                <Zap size={20} className="fill-white" />
                <span>Generate Feeds & Caption Sekaligus</span>
              </>
            )}
          </button>
        </div>

        {/* RIGHT COLUMN: Output Result / Siap Upload */}
        <div className="space-y-6 lg:col-span-7">
          {!result && !generating && (
            <div className="flex h-full min-h-[480px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-10 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-100 text-indigo-600 shadow-sm">
                <Sparkles size={36} />
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-800">
                Konten Siap Upload Akan Muncul di Sini
              </h3>
              <p className="mt-2 max-w-md text-sm text-slate-500">
                Pilih foto produk di sebelah kiri, tentukan penawaran atau diskon, lalu klik tombol <strong>Generate Feeds & Caption</strong>. Poster visual HD dan caption Instagram akan dibuat bersamaan dalam hitungan detik.
              </p>
            </div>
          )}

          {generating && (
            <div className="flex h-full min-h-[480px] flex-col items-center justify-center rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
              <div className="relative">
                <div className="h-20 w-20 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap size={28} className="fill-indigo-600 text-indigo-600 animate-pulse" />
                </div>
              </div>
              <h3 className="mt-6 text-xl font-extrabold text-slate-900">
                Sedang Memproses Konten...
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Merender poster promo beresolusi tinggi & menulis caption promosi persuasif...
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {/* Ready to Upload Status Banner */}
              <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 text-white shadow-md">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                    <CheckCircle2 size={22} className="text-white" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold">Feeds & Caption Siap Upload!</h3>
                    <p className="text-xs text-emerald-100">
                      Unduh poster visual dan salin caption untuk langsung di-posting ke Instagram.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerate}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/25"
                >
                  <RefreshCw size={13} />
                  Buat Ulang
                </button>
              </div>

              {/* Grid: Visual Poster (Left) & Caption (Right) */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* 1. Visual Poster Card */}
                <div className="flex flex-col rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                      <ImageIcon size={14} className="text-indigo-600" />
                      Poster Visual ({result.design.format})
                    </span>
                    <Link
                      href={`/editor?id=${result.design.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      <PenTool size={12} />
                      Buka Editor
                    </Link>
                  </div>

                  <div className="group relative flex-1 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                    <img
                      src={result.design.image_url}
                      alt={result.design.title}
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <div className="mt-4 flex gap-2">
                    <a
                      href={result.design.download_url}
                      download
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow transition hover:bg-slate-800"
                    >
                      <Download size={15} />
                      Unduh Gambar (HD)
                    </a>
                  </div>
                </div>

                {/* 2. Copywriting & Caption Card */}
                <div className="flex flex-col rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                      <Sparkles size={14} className="text-indigo-600" />
                      Caption Instagram
                    </span>
                    <button
                      type="button"
                      onClick={copyCaption}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                        copied
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check size={13} />
                          Tersalin!
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          Salin Caption
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex-1 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <textarea
                      readOnly
                      rows={14}
                      value={result.caption.text}
                      className="w-full resize-none bg-transparent text-xs leading-relaxed text-slate-800 focus:outline-none font-mono"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={copyCaption}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-xs font-bold text-white shadow transition hover:brightness-110"
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    {copied ? "Caption Berhasil Disalin!" : "Salin Seluruh Caption"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
