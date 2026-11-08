"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  // ArrowLeft, // tidak dipakai
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  History,
  Image as ImageIcon,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  Upload,
  Zap,
} from "lucide-react";

// ─── Tipe ────────────────────────────────────────────────────────────────────

type Img = {
  id: number;
  name: string;
  role?: "kemasan" | "hidangan" | "tekstur" | "tambahan";
};

type Design = {
  id: number;
  recipe: string;
  image_url: string;
  preview_url: string;
  download_url: string;
  quality_score: number;
  quality_passed: boolean;
};

type BatchResult = {
  ok: boolean;
  batch_id: string;
  designs: Design[];
  caption: { id: number | null; text: string };
};

type RevisionResult = {
  ok: boolean;
  design: Design & { parent_id: number; patch_applied: Record<string, unknown> };
};

// ─── Konstan ─────────────────────────────────────────────────────────────────

const RECIPES: { id: string; label: string; desc: string; emoji: string }[] = [
  { id: "hero_left_target", label: "Hero Kiri", desc: "Produk besar di kiri, teks & badge di kanan. Gaya poster profesional.", emoji: "🎯" },
  { id: "hero_center_burst", label: "Hero Tengah", desc: "Produk di pusat, burst radial di belakang, teks melingkupi.", emoji: "💥" },
  { id: "split_diagonal", label: "Split Diagonal", desc: "Latar terbagi diagonal, produk di satu sisi, teks di sisi lain.", emoji: "⚡" },
  { id: "flatlay_overhead", label: "Flatlay Overhead", desc: "Tampak atas, produk di tengah, dekorasi tersebar.", emoji: "📷" },
  { id: "price_star", label: "Bintang Harga", desc: "Harga paling menonjol di burst bintang emas. Cocok untuk flash sale.", emoji: "⭐" },
  { id: "minimal_luxury", label: "Minimalis Mewah", desc: "Latar bersih gelap, tipografi elegan, posisi premium.", emoji: "🖤" },
];

const MOODS = [
  { id: "warm", label: "Hangat & Nyaman", color: "#f97316" },
  { id: "dark", label: "Gelap & Elegan", color: "#1e1b4b" },
  { id: "bright", label: "Cerah & Segar", color: "#06b6d4" },
  { id: "luxury", label: "Mewah & Premium", color: "#7c3aed" },
  { id: "natural", label: "Natural & Organik", color: "#16a34a" },
  { id: "bold", label: "Berani & Energik", color: "#dc2626" },
];

const FORMATS = [
  { id: "feed", label: "Feed 4:5", sub: "1080×1350px" },
  { id: "square", label: "Kotak 1:1", sub: "1080×1080px" },
  { id: "story", label: "Story 9:16", sub: "1080×1920px" },
];

const GOALS = [
  { id: "diskon", label: "Diskon / Promo Harga" },
  { id: "beli_gratis", label: "Beli 1 Gratis 1" },
  { id: "bundling", label: "Bundling / Paket" },
  { id: "produk_baru", label: "Produk Baru" },
  { id: "info", label: "Informasi Biasa" },
];

// ─── Komponen pembantu ────────────────────────────────────────────────────────

const inp =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

function StepBadge({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black transition ${
        done
          ? "bg-emerald-500 text-white"
          : active
          ? "bg-indigo-600 text-white shadow-md"
          : "bg-slate-100 text-slate-400"
      }`}
    >
      {done ? <Check size={13} strokeWidth={3} /> : n}
    </span>
  );
}

function SectionCard({
  step,
  activeStep,
  title,
  children,
  onClick,
}: {
  step: number;
  activeStep: number;
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const isActive = step === activeStep;
  const isDone = step < activeStep;
  return (
    <div
      className={`rounded-3xl border transition-all ${
        isActive
          ? "border-indigo-300 bg-white shadow-lg shadow-indigo-100/50"
          : isDone
          ? "border-slate-200 bg-white/70 shadow-sm"
          : "border-slate-200 bg-slate-50/50"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 p-5 text-left"
      >
        <StepBadge n={step} active={isActive} done={isDone} />
        <span
          className={`text-sm font-bold tracking-wide ${
            isActive ? "text-slate-900" : isDone ? "text-slate-600" : "text-slate-400"
          }`}
        >
          {title}
        </span>
        <ChevronDown
          size={16}
          className={`ml-auto text-slate-400 transition-transform ${isActive ? "rotate-180" : ""}`}
        />
      </button>
      {isActive && <div className="border-t border-slate-100 px-5 pb-6 pt-4">{children}</div>}
    </div>
  );
}

// ─── Halaman Utama ────────────────────────────────────────────────────────────

export default function ExpressPage() {
  // Langkah aktif (1-5)
  const [step, setStep] = useState(1);

  // ── LANGKAH 1: Foto ──
  const [images, setImages] = useState<Img[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [selectedImages, setSelectedImages] = useState<Img[]>([]); // multi-select
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // ── LANGKAH 2: Baca produk ──
  const [reading, setReading] = useState(false);
  const [readResult, setReadResult] = useState<{
    brand?: string;
    product_name?: string;
    variant?: string;
    category?: string;
    claims?: string[];
  } | null>(null);

  // ── LANGKAH 3: Data & Pesan ──
  const [headline, setHeadline] = useState("");
  const [goal, setGoal] = useState("diskon");
  const [price, setPrice] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [benefits, setBenefits] = useState(["", "", ""]);
  const [taglines, setTaglines] = useState(["", ""]);
  const [suggestedTaglines, setSuggestedTaglines] = useState<string[]>([]);

  // ── LANGKAH 4: Arah ──
  const [recipe, setRecipe] = useState("hero_left_target");
  const [mood, setMood] = useState("warm");
  const [format, setFormat] = useState("feed");
  const [instructions, setInstructions] = useState("");
  const [referencePoster, setReferencePoster] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState("");
  const referenceInputRef = useRef<HTMLInputElement>(null);

  // ── LANGKAH 5: Hasil ──
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [activeDesignIdx, setActiveDesignIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  // Riwayat revisi per desain
  const [revisionText, setRevisionText] = useState("");
  const [revising, setRevising] = useState(false);
  const [history, setHistory] = useState<Design[][]>([]);
  // history[variantIdx] = array of designs (latest last)

  useEffect(() => () => {
    if (referencePreview) URL.revokeObjectURL(referencePreview);
  }, [referencePreview]);

  // ─── Muat galeri ────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/images", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal memuat galeri produk.");
        const list: Img[] = (data.images ?? []).map((img: { id: number; name: string }) => ({
          ...img,
          role: "kemasan" as const,
        }));
        setImages(list);
        if (list.length > 0) {
          setSelectedImages([{ ...list[0], role: "kemasan" }]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat galeri produk.");
      } finally {
        setLoadingImages(false);
      }
    }
    load();
  }, []);

  // ─── Unggah foto langsung dari langkah 1 ────────────────────────────────────

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/images", { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok && data.id) {
          const newImg: Img = { id: data.id, name: file.name.replace(/\.[^.]+$/, ""), role: "kemasan" };
          setImages((prev) => [newImg, ...prev]);
          setSelectedImages((prev) => {
            // Kalau belum ada kemasan, jadikan kemasan; lainnya tambahan
            const hasKemasan = prev.some((i) => i.role === "kemasan");
            return [...prev, { ...newImg, role: hasKemasan ? "tambahan" : "kemasan" }];
          });
        } else throw new Error(data.error || `Gagal mengunggah ${file.name}.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunggah foto.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ─── Toggle pilihan foto & atur peran ────────────────────────────────────────

  function toggleImage(img: Img) {
    setSelectedImages((prev) => {
      const idx = prev.findIndex((i) => i.id === img.id);
      if (idx >= 0) {
        // Hapus — pastikan minimal 1 kemasan tetap ada
        const next = prev.filter((i) => i.id !== img.id);
        if (!next.some((i) => i.role === "kemasan") && next.length > 0) {
          next[0] = { ...next[0], role: "kemasan" };
        }
        return next;
      }
      // Tambah — tentukan peran otomatis
      const hasDish = prev.some((i) => i.role === "hidangan");
      const hasTexture = prev.some((i) => i.role === "tekstur");
      const role = !hasDish ? "hidangan" : !hasTexture ? "tekstur" : "tambahan";
      return [...prev, { ...img, role }];
    });
  }

  function changeRole(imgId: number, role: Img["role"]) {
    setSelectedImages((prev) => prev.map((i) => (i.id === imgId ? { ...i, role } : i)));
  }

  // ─── Baca produk via Ollama/OCR ─────────────────────────────────────────────

  async function readProduct() {
    const kemasan = selectedImages.find((i) => i.role === "kemasan");
    if (!kemasan) return;
    setError("");
    setReading(true);
    setReadResult(null);
    try {
      const start = await fetch(`/api/analyze?image_id=${kemasan.id}`, { method: "POST" });
      const started = await start.json() as { error?: string };
      if (!start.ok && start.status !== 409) throw new Error(started.error || "Analisis gagal dimulai.");

      const deadline = Date.now() + 180_000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        const res = await fetch(`/api/analyze?image_id=${kemasan.id}`, { cache: "no-store" });
        const data = await res.json() as {
          job?: { status: string; error?: string } | null;
          analysis?: { description?: string; objects?: string; dominant_colors?: string; visible_text?: string } | null;
        };
        if (data.job?.status === "error") throw new Error(data.job.error || "Analisis gagal.");
        if (data.job?.status === "done" && data.analysis) {
          const analysis = data.analysis;
          const productName = analysis.description?.split(/[.!?]/)[0]?.slice(0, 80) || kemasan.name;
          const claims = [analysis.objects, analysis.visible_text].filter(Boolean) as string[];
          setReadResult({ product_name: productName, claims, category: analysis.dominant_colors ? `Warna dominan: ${analysis.dominant_colors}` : undefined });
          setHeadline(productName.toUpperCase());
          if (claims.length) setBenefits([claims[0] ?? "", claims[1] ?? "", claims[2] ?? ""]);
          return;
        }
      }
      throw new Error("Analisis memerlukan waktu lama. Anda tetap bisa mengisi nama produk secara manual.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membaca produk.");
    } finally {
      setReading(false);
    }
  }

  // ─── Sarankan tagline ────────────────────────────────────────────────────────

  async function suggestTaglines() {
    if (!headline) return;
    try {
      const res = await fetch("/api/express/suggest-taglines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_id: selectedImages.find((i) => i.role === "kemasan")?.id ?? 0,
          headline,
        }),
      });
      const data = await res.json() as { suggestions?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Saran tagline tidak tersedia.");
      if (data.suggestions?.length) setSuggestedTaglines(data.suggestions.slice(0, 3));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saran tagline tidak tersedia.");
    }
  }

  // ─── Generate 3 variasi poster ──────────────────────────────────────────────

  async function handleGenerate() {
    const kemasan = selectedImages.find((i) => i.role === "kemasan");
    if (!kemasan) {
      setError("Pilih foto kemasan produk terlebih dahulu.");
      return;
    }
    if (!headline.trim()) {
      setError("Isi nama / headline produk.");
      return;
    }

    setError("");
    setGenerating(true);
    setBatchResult(null);
    setHistory([]);

    const dish = selectedImages.find((i) => i.role === "hidangan");
    const texture = selectedImages.find((i) => i.role === "tekstur");

    try {
      const form = new FormData();
      form.append("payload", JSON.stringify({
          image_id: kemasan.id,
          dish_image_id: dish?.id ?? null,
          texture_image_id: texture?.id ?? null,
          headline: headline.trim(),
          tagline: taglines[0] || taglines[1] || "",
          format,
          recipe,
          mood,
          benefits: benefits.filter(Boolean),
          price,
          old_price: oldPrice,
          goal,
          instructions: instructions.trim(),
          recipes: null,
        }));
      if (referencePoster) form.append("reference_poster", referencePoster);
      const res = await fetch("/api/express/scene-compose", {
        method: "POST",
        body: form,
      });

      const data = await res.json() as BatchResult;
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error || "Gagal menghasilkan poster.");
      setBatchResult(data);
      setActiveDesignIdx(0);
      // Init riwayat untuk setiap variasi
      setHistory(data.designs.map((d) => [d]));
      setStep(5);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  // ─── Revisi bahasa alami ─────────────────────────────────────────────────────

  async function handleRevise() {
    if (!revisionText.trim() || !batchResult) return;
    const current = history[activeDesignIdx]?.at(-1);
    if (!current) return;

    setRevising(true);
    try {
      const kemasan = selectedImages.find((i) => i.role === "kemasan");
      const res = await fetch("/api/express/scene-compose", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design_id: current.id,
          revision: revisionText.trim(),
          image_id: kemasan?.id,
        }),
      });
      const data = await res.json() as RevisionResult;
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error || "Revisi gagal.");

      setHistory((prev) => {
        const next = [...prev];
        next[activeDesignIdx] = [...(next[activeDesignIdx] ?? []), data.design];
        return next;
      });
      // Update designs di batch
      setBatchResult((prev) => {
        if (!prev) return prev;
        const designs = [...prev.designs];
        designs[activeDesignIdx] = data.design;
        return { ...prev, designs };
      });
      setRevisionText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRevising(false);
    }
  }

  function undoRevision() {
    setHistory((prev) => {
      const next = [...prev];
      if ((next[activeDesignIdx]?.length ?? 0) > 1) {
        next[activeDesignIdx] = next[activeDesignIdx].slice(0, -1);
      }
      return next;
    });
    setBatchResult((prev) => {
      if (!prev) return prev;
      const cur = history[activeDesignIdx];
      if (cur && cur.length >= 2) {
        const designs = [...prev.designs];
        designs[activeDesignIdx] = cur[cur.length - 2];
        return { ...prev, designs };
      }
      return prev;
    });
  }

  function copyCaption() {
    if (!batchResult?.caption.text) return;
    navigator.clipboard.writeText(batchResult.caption.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const activeDesign = batchResult?.designs[activeDesignIdx];
  const activeHistory = history[activeDesignIdx] ?? [];

  const canUndo = activeHistory.length > 1;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-20">

      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 p-8 text-white shadow-2xl ring-1 ring-white/10 sm:p-10">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-950 shadow">
            <Zap size={13} className="fill-slate-950" /> Studio Poster
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Auto Feeds Express
          </h1>
          <p className="text-sm text-slate-300 sm:text-base">
            Unggah foto → isi data → pilih gaya → dapatkan <strong>3 variasi poster studio</strong> siap upload beserta caption Instagram.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/settings" className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20">Pengaturan AI</Link>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { if (n < step || batchResult) setStep(n); }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition ${
                  step === n
                    ? "bg-white/20 text-white ring-1 ring-white/30"
                    : step > n
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-white/5 text-slate-400"
                }`}
              >
                <StepBadge n={n} active={step === n} done={step > n} />
                {["Foto", "Baca Produk", "Data", "Gaya", "Hasil"][n - 1]}
              </button>
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-40 h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />
      </div>

      {/* ── Error global ── */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-500" />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="ml-auto text-rose-400 hover:text-rose-600">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

        {/* ── Kolom Kiri: Form Langkah ── */}
        <div className="space-y-4 lg:col-span-5">

          {/* ── LANGKAH 1: Foto ── */}
          <SectionCard step={1} activeStep={step} title="📸 Foto Produk" onClick={() => setStep(1)}>
            <div className="space-y-4">
              {/* Upload button */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {uploading ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
                  {uploading ? "Mengunggah..." : "Unggah Foto Baru"}
                </button>
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                >
                  <ImageIcon size={13} /> Galeri Lengkap
                </Link>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />

              {loadingImages ? (
                <div className="py-6 text-center text-xs text-slate-400 animate-pulse">Memuat galeri...</div>
              ) : images.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center text-xs text-slate-400">
                  Belum ada foto. Unggah foto pertama di atas.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {images.map((img) => {
                    const sel = selectedImages.find((s) => s.id === img.id);
                    const isSelected = !!sel;
                    const roleColors: Record<string, string> = {
                      kemasan: "ring-indigo-500",
                      hidangan: "ring-amber-500",
                      tekstur: "ring-emerald-500",
                      tambahan: "ring-slate-400",
                    };
                    return (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => toggleImage(img)}
                        className={`group relative aspect-square overflow-hidden rounded-xl border-2 transition ${
                          isSelected ? `border-transparent ring-2 ${roleColors[sel!.role ?? "kemasan"]}` : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/image-file?id=${img.id}&size=small`}
                          alt={img.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 flex flex-col items-center justify-end bg-black/30 pb-1">
                            <span className="rounded bg-black/70 px-1 py-0.5 text-[9px] font-bold text-white capitalize">
                              {sel!.role}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Peran foto yang dipilih */}
              {selectedImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-600">Peran foto terpilih:</p>
                  {selectedImages.map((img) => (
                    <div key={img.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/image-file?id=${img.id}&size=small`}
                        alt={img.name}
                        className="h-8 w-8 rounded-lg object-cover"
                      />
                      <span className="flex-1 truncate text-xs text-slate-700">{img.name}</span>
                      <select
                        value={img.role ?? "kemasan"}
                        onChange={(e) => changeRole(img.id, e.target.value as Img["role"])}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                      >
                        <option value="kemasan">📦 Kemasan (wajib)</option>
                        <option value="hidangan">🍽️ Hidangan / Hasil masak</option>
                        <option value="tekstur">🔬 Potongan / Tekstur</option>
                        <option value="tambahan">➕ Foto tambahan</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={selectedImages.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow transition hover:bg-indigo-700 disabled:opacity-50"
              >
                Lanjut: Baca Produk <ArrowRight size={14} />
              </button>
            </div>
          </SectionCard>

          {/* ── LANGKAH 2: Baca produk ── */}
          <SectionCard step={2} activeStep={step} title="🔍 Baca Produk Otomatis" onClick={() => step > 1 && setStep(2)}>
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                AI membaca merek, nama, dan klaim dari foto kemasan secara otomatis. Hasil bisa dikoreksi.
              </p>
              <button
                type="button"
                onClick={readProduct}
                disabled={reading || !selectedImages.some((i) => i.role === "kemasan")}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-violet-700 disabled:opacity-50"
              >
                {reading ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {reading ? "Membaca kemasan..." : "Baca Kemasan Sekarang"}
              </button>

              {readResult && (
                <div className="rounded-2xl bg-violet-50 p-3 ring-1 ring-violet-100 text-xs text-slate-700 space-y-1">
                  <p><strong>Merek:</strong> {readResult.brand ?? "-"}</p>
                  <p><strong>Produk:</strong> {readResult.product_name ?? "-"}</p>
                  <p><strong>Varian:</strong> {readResult.variant ?? "-"}</p>
                  <p><strong>Kategori:</strong> {readResult.category ?? "-"}</p>
                  {readResult.claims?.length ? (
                    <p><strong>Klaim:</strong> {readResult.claims.join(", ")}</p>
                  ) : null}
                  <p className="text-violet-600 font-semibold">✓ Data telah diisi ke form di bawah. Koreksi bila perlu.</p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow transition hover:bg-indigo-700"
              >
                Lanjut: Isi Data <ArrowRight size={14} />
              </button>
            </div>
          </SectionCard>

          {/* ── LANGKAH 3: Data & Pesan ── */}
          <SectionCard step={3} activeStep={step} title="📝 Data & Pesan Produk" onClick={() => step > 2 && setStep(3)}>
            <div className="space-y-4">

              {/* Headline */}
              <div>
                <label className="text-xs font-semibold text-slate-700">Nama / Headline Produk *</label>
                <input
                  type="text"
                  value={headline}
                  maxLength={60}
                  placeholder="Contoh: BAKSO SAPI PREMIUM SPESIAL"
                  onChange={(e) => setHeadline(e.target.value)}
                  className={`mt-1 ${inp}`}
                />
              </div>

              {/* Goal */}
              <div>
                <label className="text-xs font-semibold text-slate-700">Tujuan Poster</label>
                <select value={goal} onChange={(e) => setGoal(e.target.value)} className={`mt-1 ${inp}`}>
                  {GOALS.map((g) => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </div>

              {/* Harga */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Harga Promo (opsional)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={price}
                    placeholder="Rp 25.000"
                    onChange={(e) => setPrice(e.target.value)}
                    className={`mt-1 ${inp}`}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Harga Normal / Coret</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={oldPrice}
                    placeholder="Rp 35.000"
                    onChange={(e) => setOldPrice(e.target.value)}
                    className={`mt-1 ${inp}`}
                  />
                </div>
              </div>

              {/* 3 Poin Manfaat */}
              <div>
                <label className="text-xs font-semibold text-slate-700">3 Poin Manfaat / Keunggulan</label>
                {benefits.map((b, i) => (
                  <input
                    key={i}
                    type="text"
                    value={b}
                    maxLength={60}
                    placeholder={`Manfaat ${i + 1}, misal: Halal Terjamin`}
                    onChange={(e) => setBenefits((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })}
                    className={`mt-1.5 ${inp}`}
                  />
                ))}
              </div>

              {/* Tagline */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Tagline (maks 2)</label>
                  <button
                    type="button"
                    onClick={suggestTaglines}
                    className="text-[11px] font-semibold text-violet-600 hover:text-violet-700"
                  >
                    ✨ Sarankan tagline
                  </button>
                </div>
                {suggestedTaglines.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {suggestedTaglines.map((t, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setTaglines((prev) => {
                          const n = [...prev];
                          const emptyIdx = n.findIndex((x) => !x);
                          if (emptyIdx >= 0) n[emptyIdx] = t;
                          else n[0] = t;
                          return n;
                        })}
                        className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-100"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                {taglines.map((t, i) => (
                  <input
                    key={i}
                    type="text"
                    value={t}
                    maxLength={80}
                    placeholder={`Tagline ${i + 1}`}
                    onChange={(e) => setTaglines((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })}
                    className={`mt-1.5 ${inp}`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={!headline.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow transition hover:bg-indigo-700 disabled:opacity-50"
              >
                Lanjut: Pilih Gaya <ArrowRight size={14} />
              </button>
            </div>
          </SectionCard>

          {/* ── LANGKAH 4: Arah ── */}
          <SectionCard step={4} activeStep={step} title="🎨 Gaya & Tampilan" onClick={() => step > 3 && setStep(4)}>
            <div className="space-y-5">

              {/* Resep Layout */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-2 block">Gaya Poster (Pilih 1)</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {RECIPES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRecipe(r.id)}
                      title={r.desc}
                      className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-center transition ${
                        recipe === r.id
                          ? "border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100"
                          : "border-slate-200 bg-white hover:border-indigo-300"
                      }`}
                    >
                      <span className="text-2xl">{r.emoji}</span>
                      <span className="text-[11px] font-bold text-slate-800">{r.label}</span>
                      <span className="text-[10px] text-slate-500 leading-tight">{r.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Suasana */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-2 block">Suasana / Mood</label>
                <div className="flex flex-wrap gap-2">
                  {MOODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMood(m.id)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                        mood === m.id
                          ? "border-transparent text-white shadow"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                      style={mood === m.id ? { background: m.color } : {}}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Format */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-2 block">Ukuran Output</label>
                <div className="flex gap-2">
                  {FORMATS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFormat(f.id)}
                      className={`flex-1 rounded-xl border-2 py-2 text-center transition ${
                        format === f.id
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="text-[11px] font-bold text-slate-800">{f.label}</div>
                      <div className="text-[10px] text-slate-400">{f.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Instruksi bebas */}
              <div>
                <label className="text-xs font-semibold text-slate-700">Instruksi Tambahan (opsional)</label>
                <textarea
                  rows={2}
                  value={instructions}
                  maxLength={200}
                  placeholder="Contoh: tampilkan badge GRATIS ONGKIR, latar lebih gelap, font lebih besar"
                  onChange={(e) => setInstructions(e.target.value)}
                  className={`mt-1 ${inp}`}
                />
              </div>

              <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
                <div className="mb-2">
                  <p className="text-xs font-bold text-violet-950">Poster referensi (opsional)</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-violet-800">Unggah poster jadi untuk panduan warna, suasana, dan komposisi. AI meniru arah visualnya; foto produk dan teks promosi Anda tetap dipakai.</p>
                </div>
                <input
                  ref={referenceInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setReferencePoster(file);
                    setReferencePreview(file ? URL.createObjectURL(file) : "");
                  }}
                />
                {referencePoster && referencePreview ? (
                  <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={referencePreview} alt="Pratinjau poster referensi" className="h-20 w-16 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800">{referencePoster.name}</p>
                      <p className="text-[10px] text-slate-500">{(referencePoster.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button type="button" onClick={() => { setReferencePoster(null); if (referenceInputRef.current) referenceInputRef.current.value = ""; }} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">Hapus</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => referenceInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-300 bg-white px-3 py-3 text-xs font-semibold text-violet-800 transition hover:border-violet-500 hover:bg-violet-100/60">
                    <Upload size={14} /> Pilih poster referensi
                  </button>
                )}
              </div>

              {/* Tombol Generate */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || !selectedImages.some((i) => i.role === "kemasan") || !headline.trim()}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 py-4 text-sm font-extrabold text-white shadow-xl shadow-indigo-600/30 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
              >
                {generating ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Merender 3 Variasi Poster...</span>
                  </>
                ) : (
                  <>
                    <Zap size={18} className="fill-white" />
                    <span>Generate 3 Variasi Poster Studio</span>
                  </>
                )}
              </button>
            </div>
          </SectionCard>
        </div>

        {/* ── Kolom Kanan: Hasil ── */}
        <div className="space-y-6 lg:col-span-7">
          {/* Placeholder sebelum generate */}
          {!batchResult && !generating && (
            <div className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-10 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-100 text-indigo-600">
                <Sparkles size={36} />
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-700">3 Variasi Poster Studio</h3>
              <p className="mt-2 max-w-xs text-sm text-slate-400">
                Isi form di kiri dan klik <strong>Generate</strong>. Sistem akan membuat 3 variasi poster profesional sekaligus.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-xs text-slate-400">
                {RECIPES.slice(0, 3).map((r) => (
                  <div key={r.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                    <div className="text-2xl">{r.emoji}</div>
                    <div className="mt-1 font-semibold">{r.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {generating && (
            <div className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
              <div className="relative">
                <div className="h-20 w-20 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap size={28} className="fill-indigo-600 text-indigo-600" />
                </div>
              </div>
              <h3 className="mt-6 text-xl font-extrabold text-slate-900">Merender Poster Studio...</h3>
              <p className="mt-2 text-sm text-slate-400">Memproses 3 variasi secara paralel. Ini memakan ~15–30 detik.</p>
              <div className="mt-4 flex gap-2">
                {["Hero Kiri", "Hero Tengah", "Variasi 3"].map((l) => (
                  <span key={l} className="animate-pulse rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-600">{l}</span>
                ))}
              </div>
            </div>
          )}

          {/* Hasil */}
          {batchResult && !generating && (
            <div className="space-y-5">
              {/* Status bar */}
              <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-white shadow">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={20} />
                  <div>
                    <div className="text-sm font-bold">
                      {batchResult.designs.length} Variasi Poster Siap!
                    </div>
                    <div className="text-xs text-emerald-100">Pilih variasi, revisi, atau unduh</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setBatchResult(null); setStep(4); }}
                  className="rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm hover:bg-white/25"
                >
                  <RefreshCw size={12} className="inline mr-1" />
                  Buat Ulang
                </button>
              </div>

              {/* Tab variasi */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {batchResult.designs.map((d, i) => {
                  const rec = RECIPES.find((r) => r.id === d.recipe);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setActiveDesignIdx(i)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-xs font-semibold transition ${
                        activeDesignIdx === i
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <span>{rec?.emoji ?? "🎨"}</span>
                      <span>{rec?.label ?? d.recipe}</span>
                      {d.quality_passed ? (
                        <Star size={11} className="fill-amber-400 text-amber-400" />
                      ) : (
                        <AlertCircle size={11} className="text-orange-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Preview & Actions */}
              {activeDesign && (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  {/* Poster preview */}
                  <div className="flex flex-col rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <ImageIcon size={13} className="text-indigo-600" />
                        {RECIPES.find((r) => r.id === activeDesign.recipe)?.label ?? "Poster"}
                        {activeDesign.quality_passed && (
                          <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                            Skor: {activeDesign.quality_score}
                          </span>
                        )}
                      </span>
                      {canUndo && (
                        <button
                          type="button"
                          onClick={undoRevision}
                          className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                        >
                          <History size={12} /> Batalkan revisi
                        </button>
                      )}
                    </div>

                    <div className="relative flex-1 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        key={activeDesign.preview_url}
                        src={activeDesign.preview_url}
                        alt="Preview poster"
                        className="h-full w-full object-contain"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = activeDesign.image_url; }}
                      />
                    </div>

                    <div className="mt-3 flex gap-2">
                      <a
                        href={activeDesign.download_url}
                        download
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
                      >
                        <Download size={13} /> Unduh JPG
                      </a>
                      <a
                        href={`${activeDesign.download_url}&format=png`}
                        download
                        className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        PNG
                      </a>
                    </div>

                    {/* Kotak revisi bahasa alami */}
                    <div className="mt-3 rounded-2xl bg-indigo-50 p-3 ring-1 ring-indigo-100">
                      <p className="mb-1.5 text-[11px] font-bold text-indigo-700">Revisi dengan kalimat bebas:</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={revisionText}
                          maxLength={200}
                          placeholder={`"latar lebih gelap", "produk lebih besar", "gaya minimal"`}
                          onChange={(e) => setRevisionText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleRevise(); }}
                          className="flex-1 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleRevise}
                          disabled={revising || !revisionText.trim()}
                          className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {revising ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                        </button>
                      </div>
                      {activeHistory.length > 1 && (
                        <p className="mt-1.5 text-[10px] text-indigo-500">
                          <History size={10} className="inline mr-1" />
                          {activeHistory.length - 1} revisi • Tombol &quot;Batalkan&quot; untuk kembali
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Caption */}
                  <div className="flex flex-col rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <Sparkles size={13} className="text-indigo-600" />
                        Caption Instagram
                      </span>
                      <button
                        type="button"
                        onClick={copyCaption}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                          copied ? "bg-emerald-100 text-emerald-700" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        }`}
                      >
                        {copied ? <><Check size={12} /> Tersalin!</> : <><Copy size={12} /> Salin</>}
                      </button>
                    </div>

                    <div className="flex-1 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
                      <textarea
                        readOnly
                        rows={16}
                        value={batchResult.caption.text}
                        className="w-full resize-none bg-transparent font-mono text-xs leading-relaxed text-slate-800 focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={copyCaption}
                      className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-xs font-bold text-white shadow transition hover:brightness-110"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Caption Berhasil Disalin!" : "Salin Seluruh Caption"}
                    </button>

                    {/* Navigasi langkah lanjutan */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Link
                        href={`/editor?id=${activeDesign.id}`}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        ✏️ Edit Manual
                      </Link>
                      <button
                        type="button"
                        onClick={handleGenerate}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 py-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        <RefreshCw size={11} /> Variasi Baru
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
