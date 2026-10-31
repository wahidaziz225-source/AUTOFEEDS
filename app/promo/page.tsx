"use client";
/* eslint-disable @next/next/no-img-element */

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
type Sel = { imageId: number; name: string; price: string; oldPrice: string };
type Design = { id: number; title: string; layout_format: string; created_at: string };

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

export default function PromoPage() {
  const [images, setImages] = useState<Img[]>([]);
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
  const [format, setFormat] = useState("feed");
  const [style, setStyle] = useState("retail");
  const [theme, setTheme] = useState("acak");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultId, setResultId] = useState<number | null>(null);
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

  function changeType(next: string) {
    setType(next);
    setError("");
    const defaults = PROMO_TYPES.map((t) => t.defaultTitle as string);
    if (defaults.includes(title)) {
      setTitle(PROMO_TYPES.find((t) => t.id === next)?.defaultTitle ?? title);
    }
  }

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

  function preview(s: Sel): string {
    if (type === "bundling" || !s.price.trim()) return "";
    const c = computeItem(type, params, s.price, s.oldPrice);
    if (!c.ok) return c.error;
    return `${c.oldText ? c.oldText + " → " : ""}${c.priceText}${c.tag ? "  (" + c.tag + ")" : ""}`;
  }

  async function generate() {
    setError("");
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
          theme,
          style,
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

  const normalTotal = (() => {
    const vals = sel.map((s) => parseAmount(s.price));
    return vals.length > 0 && vals.every((v) => v) ? (vals as number[]).reduce((a, b) => a + b, 0) : null;
  })();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Promo Composer</h1>
        <p className="text-sm text-slate-500">
          Pilih jenis promo dan sampai {MAX_PROMO_ITEMS} produk. Pilih satu dari enam konsep komposisi. Foto asli dan informasi produk tetap digunakan.
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
                <div className="mt-2 flex flex-wrap gap-2">
                  {PROMO_THEMES.map((t) => (
                    <button
                      key={t.id}
                      title={t.label}
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
            <div className="flex flex-wrap gap-2">
              <button
                onClick={generate}
                disabled={busy}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {busy ? "Menyusun desain..." : "Buat visual promo"}
              </button>
              {resultId != null && (
                <button
                  onClick={generate}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
                >
                  <Shuffle size={16} /> Buat variasi lain
                </button>
              )}
            </div>
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