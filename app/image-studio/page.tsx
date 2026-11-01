"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  Sparkles,
  Layers,
  Image as ImageIcon,
  Download,
  Bookmark,
  RefreshCw,
  Eye,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  ArrowRight,
  Maximize2,
  Tag,
  Zap,
  ShoppingBag,
  Check,
  ChevronRight,
  Scissors
} from "lucide-react";
import {
  CREATIVE_STYLES,
  PRODUCT_CATEGORIES,
  CONTENT_FORMATS,
  type CreativeStyle,
  type CreativeCategory,
  type ContentFormat
} from "@/lib/creative-styles-data";

type TabMode = "creative_variations" | "carousel_studio" | "isolation_lab";

interface VariantResult {
  id: number;
  batch_id: string;
  index: number;
  style_id: string;
  style_name: string;
  composition: string;
  headline: string;
  format: string;
  filename: string;
  url: string;
  download_url: string;
  is_favorite?: boolean;
}

interface CarouselSlide {
  id: number;
  batch_id: string;
  slide: number;
  title: string;
  badge: string;
  filename: string;
  url: string;
  download_url: string;
}

interface PhotoItem {
  id: number;
  name: string;
  stored_filename: string;
}

const checker = {
  backgroundColor: "#fff",
  backgroundImage: "conic-gradient(#e2e8f0 25%, transparent 0 50%, #e2e8f0 0 75%, transparent 0)",
  backgroundSize: "20px 20px"
};

export default function ImageStudioPage() {
  const [activeTab, setActiveTab] = useState<TabMode>("creative_variations");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<number>(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string>("");

  // Form State
  const [productName, setProductName] = useState("Chicken Nugget Belfoods 500g");
  const [headline, setHeadline] = useState("Renyah di Luar, Lembut Bergizi di Dalam");
  const [description, setDescription] = useState("Dibuat dari daging ayam pilihan berkualitas tinggi dengan rempah gurih.");
  const [priceNormal, setPriceNormal] = useState("65.000");
  const [pricePromo, setPricePromo] = useState("45.000");
  const [discountTag, setDiscountTag] = useState("30%");
  const [ctaText, setCtaText] = useState("Beli Sekarang");
  const [selectedCategory, setSelectedCategory] = useState("food");
  const [selectedStyle, setSelectedStyle] = useState("auto");
  const [selectedFormat, setSelectedFormat] = useState("portrait");
  const [variationCount, setVariationCount] = useState<number>(8);

  // Carousel specific inputs
  const [uspPoint1, setUspPoint1] = useState("100% Daging Ayam Pilihan Grade A");
  const [uspPoint2, setUspPoint2] = useState("Renyah Krispi & Tanpa Pengawet Buatan");
  const [uspPoint3, setUspPoint3] = useState("Praktis Siap Goreng Dalam 3 Menit");
  const [profileHandle, setProfileHandle] = useState("@autofeeds.id");

  // Output States
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedVariants, setGeneratedVariants] = useState<VariantResult[]>([]);
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [activeModalItem, setActiveModalItem] = useState<VariantResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load photos on mount
  useEffect(() => {
    fetch("/api/images")
      .then((res) => res.json())
      .then((data) => {
        if (data.images && data.images.length > 0) {
          setPhotos(data.images);
          setSelectedPhotoId(data.images[0].id);
        }
      })
      .catch((err) => console.error("Gagal memuat foto:", err));

    // Load favorites
    fetch("/api/creative-studio?mode=favorites")
      .then((res) => res.json())
      .then((data) => {
        if (data.favorites) {
          setFavorites(data.favorites.map((f: any) => f.id));
        }
      })
      .catch(() => {});
  }, []);

  // Calculate discount percentage automatically
  useEffect(() => {
    const pn = parseFloat(priceNormal.replace(/[^0-9]/g, ""));
    const pp = parseFloat(pricePromo.replace(/[^0-9]/g, ""));
    if (pn > 0 && pp > 0 && pn > pp) {
      const pct = Math.round(((pn - pp) / pn) * 100);
      setDiscountTag(`${pct}%`);
    }
  }, [priceNormal, pricePromo]);

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const url = URL.createObjectURL(file);
      setUploadedPreview(url);
      setSelectedPhotoId(0); // custom upload mode
    }
  };

  // Generate Variations Handler
  const handleGenerateVariations = async () => {
    setIsGenerating(true);
    setGenerationProgress(15);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const formData = new FormData();
      formData.append("action", "generate_variations");
      formData.append("count", String(variationCount));
      formData.append("style", selectedStyle);
      formData.append("format", selectedFormat);
      formData.append("category", selectedCategory);
      formData.append("product_name", productName);
      formData.append("headline", headline);
      formData.append("description", description);
      formData.append("price_normal", priceNormal);
      formData.append("price_promo", pricePromo);
      formData.append("discount_tag", discountTag);
      formData.append("cta_text", ctaText);

      if (uploadedFile) {
        formData.append("image", uploadedFile);
      } else if (selectedPhotoId > 0) {
        // Resolve upload path via image file endpoint
        const targetPhoto = photos.find((p) => p.id === selectedPhotoId);
        if (targetPhoto) {
          formData.append("image_path", `storage/uploads/${targetPhoto.stored_filename}`);
        }
      }

      setGenerationProgress(45);

      const res = await fetch("/api/creative-studio", {
        method: "POST",
        body: formData,
      });

      setGenerationProgress(80);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menghasilkan variasi desain");
      }

      setGeneratedVariants(data.variants || []);
      setGenerationProgress(100);
      setSuccessMsg(`Berhasil menghasilkan ${data.total} variasi desain berkualitas tinggi!`);
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat memproses desain.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate Carousel Handler
  const handleGenerateCarousel = async () => {
    setIsGenerating(true);
    setGenerationProgress(20);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const formData = new FormData();
      formData.append("action", "generate_carousel");
      formData.append("style", selectedStyle === "auto" ? "premium_ad" : selectedStyle);
      formData.append("format", selectedFormat);
      formData.append("product_name", productName);
      formData.append("headline", headline);
      formData.append("price_normal", priceNormal);
      formData.append("price_promo", pricePromo);
      formData.append("discount_tag", discountTag);
      formData.append("cta_text", ctaText);
      formData.append(
        "usp_points",
        JSON.stringify([uspPoint1, uspPoint2, uspPoint3].filter(Boolean))
      );

      if (uploadedFile) {
        formData.append("image", uploadedFile);
      } else if (selectedPhotoId > 0) {
        const targetPhoto = photos.find((p) => p.id === selectedPhotoId);
        if (targetPhoto) {
          formData.append("image_path", `storage/uploads/${targetPhoto.stored_filename}`);
        }
      }

      setGenerationProgress(65);

      const res = await fetch("/api/creative-studio", {
        method: "POST",
        body: formData,
      });

      setGenerationProgress(90);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal membuat Instagram Carousel.");
      }

      setCarouselSlides(data.slides || []);
      setGenerationProgress(100);
      setSuccessMsg("Instagram Carousel 5-Slide siap dipublikasikan!");
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memproses carousel.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async (designId: number) => {
    try {
      const res = await fetch("/api/creative-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_favorite", design_id: designId }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.is_favorite === 1) {
          setFavorites((prev) => [...prev, designId]);
        } else {
          setFavorites((prev) => prev.filter((id) => id !== designId));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter styles based on category recommendations
  const activeCategoryMeta = useMemo(() => {
    return PRODUCT_CATEGORIES.find((c) => c.id === selectedCategory) || PRODUCT_CATEGORIES[0];
  }, [selectedCategory]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700 mb-2">
            <Sparkles size={14} className="text-indigo-600 animate-pulse" />
            AI CREATIVE STUDIO PRO
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Studio Desain Promosi Otomatis
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Unggah satu foto produk asli dan hasilkan desain promosi profesional, variatif, dan siap unggah ke media sosial.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setActiveTab("creative_variations")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
              activeTab === "creative_variations"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sparkles size={15} />
            Variasi Desain (6–12)
          </button>
          <button
            onClick={() => setActiveTab("carousel_studio")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
              activeTab === "carousel_studio"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers size={15} />
            Instagram Carousel (5 Slide)
          </button>
          <button
            onClick={() => setActiveTab("isolation_lab")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
              activeTab === "isolation_lab"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Scissors size={15} />
            Isolasi Produk Lab
          </button>
        </div>
      </header>

      {/* Alerts */}
      {errorMsg && (
        <div className="flex items-center gap-3 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm font-medium text-rose-800">
          <AlertCircle size={20} className="shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-medium text-emerald-800">
          <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Grid: Control Panel (Left) & Gallery Canvas (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form: 5 Columns */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            {/* 1. Upload & Photo Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                1. Foto Produk Asli (100% Terjaga)
              </label>

              <div className="flex gap-4 items-center">
                {/* Photo Preview Thumbnail */}
                <div
                  style={checker}
                  className="h-24 w-24 shrink-0 rounded-2xl border-2 border-slate-200 overflow-hidden flex items-center justify-center p-1.5 shadow-inner"
                >
                  {uploadedPreview ? (
                    <img
                      src={uploadedPreview}
                      alt="Upload preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : selectedPhotoId > 0 ? (
                    <img
                      src={`/api/image-file?id=${selectedPhotoId}&size=small`}
                      alt="Catalog preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="text-slate-300" size={32} />
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
                  >
                    <Upload size={14} />
                    Unggah Foto Baru
                  </button>

                  {photos.length > 0 && (
                    <select
                      value={selectedPhotoId}
                      onChange={(e) => {
                        setSelectedPhotoId(Number(e.target.value));
                        setUploadedFile(null);
                        setUploadedPreview("");
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 focus:bg-white"
                    >
                      <option value={0}>Atau pilih dari galeri produk...</option>
                      {photos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                AI akan mengisolasi latar belakang secara otomatis tanpa mengubah label, logo, warna, atau proporsi kemasan asli.
              </p>
            </div>

            <hr className="border-slate-100" />

            {/* 2. Informasi Produk & Headline */}
            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Konten Promosi
              </label>

              <div>
                <span className="text-xs font-semibold text-slate-700">Nama Produk</span>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Misal: Sambal Cakalang Premium"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-700">Headline Promosi (Focal Point)</span>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Misal: Sensasi Pedas Nagih & Gurih Alami"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-700">Deskripsi Singkat / Subheadline</span>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Misal: Dibuat dari ikan cakalang segar asap tradisional."
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Harga & Diskon */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-xs font-semibold text-slate-700">Harga Normal</span>
                  <input
                    type="text"
                    value={priceNormal}
                    onChange={(e) => setPriceNormal(e.target.value)}
                    placeholder="65.000"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600"
                  />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-700">Harga Promo</span>
                  <input
                    type="text"
                    value={pricePromo}
                    onChange={(e) => setPricePromo(e.target.value)}
                    placeholder="45.000"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-indigo-600"
                  />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-700">Badge Diskon</span>
                  <input
                    type="text"
                    value={discountTag}
                    onChange={(e) => setDiscountTag(e.target.value)}
                    placeholder="30%"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-amber-600"
                  />
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-700">Teks Tombol (Call to Action)</span>
                <input
                  type="text"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder="Beli Sekarang"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700"
                />
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* 3. Parameter Desain & Visual */}
            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                3. Parameter Desain
              </label>

              {/* Kategori Produk */}
              <div>
                <span className="text-xs font-semibold text-slate-700">Kategori Produk (Visual Intelligence)</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gaya Desain */}
              <div>
                <span className="text-xs font-semibold text-slate-700">Gaya Desain Visual</span>
                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  <option value="auto">✨ Otomatis / Semua Gaya (Direkomendasikan)</option>
                  {CREATIVE_STYLES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ukuran Preset */}
              <div>
                <span className="text-xs font-semibold text-slate-700">Ukuran Konten Media Sosial</span>
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  {CONTENT_FORMATS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Jumlah Variasi (Hanya di tab variasai) */}
              {activeTab === "creative_variations" && (
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>Jumlah Variasi Desain</span>
                    <span className="text-indigo-600 font-bold">{variationCount} Desain</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[6, 8, 10, 12].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setVariationCount(num)}
                        className={`py-2 rounded-xl text-xs font-bold border transition ${
                          variationCount === num
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {num} Variasi
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Carousel Specific Options */}
              {activeTab === "carousel_studio" && (
                <div className="space-y-3 p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                  <span className="text-xs font-bold text-indigo-900 block">3 Poin Keunggulan (Slide 2)</span>
                  <input
                    type="text"
                    value={uspPoint1}
                    onChange={(e) => setUspPoint1(e.target.value)}
                    placeholder="Keunggulan 1"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
                  />
                  <input
                    type="text"
                    value={uspPoint2}
                    onChange={(e) => setUspPoint2(e.target.value)}
                    placeholder="Keunggulan 2"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
                  />
                  <input
                    type="text"
                    value={uspPoint3}
                    onChange={(e) => setUspPoint3(e.target.value)}
                    placeholder="Keunggulan 3"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
                  />
                  <div>
                    <span className="text-[11px] font-semibold text-slate-600">Username Akun Instagram (Slide 5)</span>
                    <input
                      type="text"
                      value={profileHandle}
                      onChange={(e) => setProfileHandle(e.target.value)}
                      placeholder="@autofeeds.id"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Trigger Button */}
            <div className="pt-2">
              {activeTab === "creative_variations" ? (
                <button
                  type="button"
                  disabled={isGenerating || (!selectedPhotoId && !uploadedFile)}
                  onClick={handleGenerateVariations}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:opacity-95 transition disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Memproses {variationCount} Variasi... ({generationProgress}%)
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Generate {variationCount} Desain Promosi
                    </>
                  )}
                </button>
              ) : activeTab === "carousel_studio" ? (
                <button
                  type="button"
                  disabled={isGenerating || (!selectedPhotoId && !uploadedFile)}
                  onClick={handleGenerateCarousel}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-purple-200 hover:opacity-95 transition disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Membuat Carousel 5 Slide... ({generationProgress}%)
                    </>
                  ) : (
                    <>
                      <Layers size={18} />
                      Generate 5-Slide Carousel
                    </>
                  )}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right Area: 7 Columns (Gallery & Output Canvas) */}
        <div className="lg:col-span-7 space-y-6">
          {/* TAB 1: Variasi Desain */}
          {activeTab === "creative_variations" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Galeri Variasi Desain ({generatedVariants.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Setiap desain memiliki komposisi, pencahayaan, dan tipografi unik yang siap tayang.
                  </p>
                </div>

                {generatedVariants.length > 0 && (
                  <button
                    type="button"
                    onClick={handleGenerateVariations}
                    disabled={isGenerating}
                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
                  >
                    <RefreshCw size={13} className={isGenerating ? "animate-spin" : ""} />
                    Regenerate Semua
                  </button>
                )}
              </div>

              {/* Progress Indicator */}
              {isGenerating && (
                <div className="rounded-3xl border border-indigo-100 bg-indigo-50/50 p-6 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-300">
                    <Loader2 size={24} className="animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-indigo-900">
                      Menerapkan Kecerdasan Visual AI...
                    </h3>
                    <p className="text-xs text-indigo-600 mt-0.5">
                      Menghapus background, mengatur pencahayaan studio, dan memasang tata letak komersial.
                    </p>
                  </div>
                  <div className="w-full bg-indigo-200/60 rounded-full h-2 overflow-hidden max-w-md mx-auto">
                    <div
                      className="bg-indigo-600 h-2 transition-all duration-300"
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!isGenerating && generatedVariants.length === 0 && (
                <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400">
                    <Sparkles size={28} />
                  </div>
                  <div className="max-w-md mx-auto">
                    <h3 className="text-base font-bold text-slate-900">
                      Belum Ada Desain yang Dihasilkan
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Pilih atau unggah foto produk di panel kiri, tentukan gaya atau gunakan mode otomatis, lalu klik tombol <strong>Generate Desain</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Gallery Grid */}
              {generatedVariants.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {generatedVariants.map((item) => {
                    const isFav = favorites.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        className="group relative rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col"
                      >
                        {/* Image Preview Container */}
                        <div className="relative aspect-[4/5] bg-slate-950 overflow-hidden">
                          <img
                            src={item.url}
                            alt={item.headline}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />

                          {/* Top Badges */}
                          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                            <span className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-[10px] font-bold text-white shadow">
                              #{item.index} • {item.style_name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-[10px] font-bold text-white shadow">
                              {item.composition}
                            </span>
                          </div>

                          {/* Hover Actions Bar */}
                          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => setActiveModalItem(item)}
                              className="p-3 rounded-2xl bg-white text-slate-900 hover:bg-slate-100 shadow-lg transition"
                              title="Perbesar Preview"
                            >
                              <Maximize2 size={18} />
                            </button>
                            <a
                              href={item.download_url}
                              className="p-3 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg transition"
                              title="Download Resolusi Tinggi"
                            >
                              <Download size={18} />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleToggleFavorite(item.id)}
                              className={`p-3 rounded-2xl shadow-lg transition ${
                                isFav
                                  ? "bg-amber-500 text-white"
                                  : "bg-white text-slate-700 hover:text-amber-500"
                              }`}
                              title={isFav ? "Hapus dari Favorit" : "Simpan ke Favorit"}
                            >
                              <Bookmark size={18} />
                            </button>
                          </div>
                        </div>

                        {/* Card Footer Info */}
                        <div className="p-4 flex items-center justify-between bg-white border-t border-slate-100 text-xs">
                          <div className="truncate max-w-[190px]">
                            <span className="font-bold text-slate-900 block truncate">
                              {item.headline}
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate">
                              {item.style_name}
                            </span>
                          </div>
                          <a
                            href={item.download_url}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 font-bold hover:bg-indigo-50 hover:text-indigo-600 transition"
                          >
                            <Download size={12} />
                            HD
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Instagram Carousel */}
          {activeTab === "carousel_studio" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Instagram Carousel (5 Slide Terhubung)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Desain yang saling terhubung secara visual saat pengguna melakukan swipe di Instagram.
                  </p>
                </div>
              </div>

              {carouselSlides.length === 0 && !isGenerating && (
                <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-3xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Layers size={28} />
                  </div>
                  <div className="max-w-md mx-auto">
                    <h3 className="text-base font-bold text-slate-900">
                      Carousel Belum Dibuat
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Klik tombol <strong>Generate 5-Slide Carousel</strong> di sebelah kiri untuk menghasilkan alur cerita promosi yang memikat dari Cover hingga CTA.
                    </p>
                  </div>
                </div>
              )}

              {carouselSlides.length > 0 && (
                <div className="space-y-4">
                  {/* Horizontal Scroll Deck */}
                  <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                    {carouselSlides.map((slide) => (
                      <div
                        key={slide.slide}
                        className="w-[280px] shrink-0 snap-center rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-lg transition"
                      >
                        <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 text-xs">
                          <span className="font-bold text-purple-700">Slide {slide.slide}/5</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 font-semibold text-slate-700">
                            {slide.title}
                          </span>
                        </div>
                        <div className="relative aspect-[4/5] bg-slate-900">
                          <img
                            src={slide.url}
                            alt={slide.title}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-3 flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-600">
                            {slide.badge}
                          </span>
                          <a
                            href={slide.download_url}
                            className="p-2 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 transition"
                            title="Unduh slide ini"
                          >
                            <Download size={14} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-purple-50 border border-purple-100">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
                      <CheckCircle2 size={16} className="text-purple-600" />
                      5 Slide Berhasil Dibuat dan Siap Diunggah
                    </div>
                    <div className="flex gap-2">
                      {carouselSlides.map((s) => (
                        <a
                          key={s.slide}
                          href={s.download_url}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition"
                        >
                          Unduh #{s.slide}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Product Isolation Lab */}
          {activeTab === "isolation_lab" && (
            <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Product Isolation Lab</h2>
                <p className="text-xs text-slate-500">
                  Pratinjau hasil pemotongan latar belakang transparan dari model AI lokal U2NETP.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="p-3 border-b text-xs font-bold text-slate-700 bg-slate-50">
                    Foto Produk Asli
                  </div>
                  <div style={checker} className="h-64 flex items-center justify-center p-4">
                    {uploadedPreview ? (
                      <img
                        src={uploadedPreview}
                        alt="Original"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : selectedPhotoId > 0 ? (
                      <img
                        src={`/api/image-file?id=${selectedPhotoId}&size=small`}
                        alt="Original"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <p className="text-xs text-slate-400">Pilih foto produk</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="p-3 border-b text-xs font-bold text-indigo-700 bg-indigo-50/50 flex justify-between">
                    <span>Hasil Isolasi Transparan</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      U2NETP ONNX
                    </span>
                  </div>
                  <div style={checker} className="h-64 flex items-center justify-center p-4">
                    {selectedPhotoId > 0 ? (
                      <img
                        src={`/api/image-file?id=${selectedPhotoId}&size=small`}
                        alt="Isolated"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <p className="text-xs text-slate-400">Pilih foto produk</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <span className="font-bold text-slate-900 block">Jaminan Integritas Produk:</span>
                <p>✓ Tidak ada distorsi pada kemasan, logo merek, atau tulisan komposisi.</p>
                <p>✓ Warna asli produk dipertahankan 100% tanpa manipulasi saturasi ekstrem.</p>
                <p>✓ Hanya latar belakang luar yang dipisahkan agar siap dipasangi panggung studio profesional.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Zoom & Detail View */}
      {activeModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]">
            <div className="md:w-3/5 bg-slate-950 flex items-center justify-center p-4">
              <img
                src={activeModalItem.url}
                alt={activeModalItem.headline}
                className="max-h-[75vh] w-auto object-contain rounded-2xl"
              />
            </div>
            <div className="md:w-2/5 p-6 flex flex-col justify-between space-y-4 overflow-y-auto">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700">
                    {activeModalItem.style_name}
                  </span>
                  <button
                    onClick={() => setActiveModalItem(null)}
                    className="text-slate-400 hover:text-slate-900 text-sm font-bold"
                  >
                    ✕ Tutup
                  </button>
                </div>
                <h3 className="text-xl font-bold text-slate-900 leading-tight">
                  {activeModalItem.headline}
                </h3>
                <div className="text-xs text-slate-500 space-y-1">
                  <p><strong>Komposisi:</strong> {activeModalItem.composition}</p>
                  <p><strong>Format:</strong> {activeModalItem.format}</p>
                  <p><strong>Status AI:</strong> Resolusi Penuh Siap Tayang</p>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100">
                <a
                  href={activeModalItem.download_url}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition"
                >
                  <Download size={16} />
                  Download Resolusi Penuh (HD)
                </a>
                <button
                  type="button"
                  onClick={() => handleToggleFavorite(activeModalItem.id)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 font-bold text-sm text-slate-700 hover:bg-slate-50 transition"
                >
                  <Bookmark size={16} />
                  {favorites.includes(activeModalItem.id) ? "Tersimpan di Favorit" : "Simpan ke Favorit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
