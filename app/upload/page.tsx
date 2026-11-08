"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  UploadCloud,
  Trash2,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const MAX_MB = 10;

type Category = { id: number; name: string };

type SavedImage = {
  id: number;
  name: string;
  original_filename: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  category_name: string | null;
  created_at: string;
};

type Pending = {
  key: string;
  file: File;
  preview: string;
  name: string;
  categoryId: string;
  status: "ready" | "uploading" | "error";
  message?: string;
};

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(s: string): string {
  const d = new Date(s.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? s : d.toLocaleString("id-ID");
}

export default function UploadPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [saved, setSaved] = useState<SavedImage[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadImages = useCallback(async () => {
    try {
      const res = await fetch("/api/images", { cache: "no-store" });
      const data = await res.json();
      setSaved(data.images ?? []);
    } catch {
      setErrors((e) => [...e, "Gagal memuat daftar gambar."]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/categories", { cache: "no-store" });
        const data = await res.json();
        setCategories(data.categories ?? []);
      } catch {
        /* kategori opsional */
      }
      await loadImages();
    })();
  }, [loadImages]);

  function addFiles(list: FileList | File[]) {
    const problems: string[] = [];
    const added: Pending[] = [];
    for (const file of Array.from(list)) {
      if (!/\.(jpe?g|png|webp)$/i.test(file.name)) {
        problems.push(`${file.name}: format tidak didukung (gunakan JPG, JPEG, PNG, atau WEBP).`);
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        problems.push(`${file.name}: lebih dari ${MAX_MB} MB.`);
        continue;
      }
      added.push({
        key: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        preview: URL.createObjectURL(file),
        name: file.name.replace(/\.[^.]+$/, ""),
        categoryId: "",
        status: "ready",
      });
    }
    setErrors(problems);
    setNotice("");
    if (added.length) setPending((p) => [...p, ...added]);
  }

  function removePending(key: string) {
    setPending((p) => {
      const item = p.find((x) => x.key === key);
      if (item) URL.revokeObjectURL(item.preview);
      return p.filter((x) => x.key !== key);
    });
  }

  function patchPending(key: string, patch: Partial<Pending>) {
    setPending((p) => p.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }

  async function uploadAll() {
    setBusy(true);
    setNotice("");
    let ok = 0;
    const warnings: string[] = [];

    for (const item of pending) {
      patchPending(item.key, { status: "uploading", message: undefined });
      try {
        const form = new FormData();
        form.append("file", item.file);
        form.append("name", item.name);
        form.append("category_id", item.categoryId);
        const res = await fetch("/api/images", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan.");
        if (data.warning) warnings.push(`${item.name}: ${data.warning}`);
        ok++;
        removePending(item.key);
      } catch (e) {
        patchPending(item.key, {
          status: "error",
          message: e instanceof Error ? e.message : "Gagal menyimpan.",
        });
      }
    }

    await loadImages();
    setBusy(false);
    if (ok > 0) setNotice(`${ok} gambar berhasil disimpan.`);
    if (warnings.length) setErrors(warnings);
  }

  async function deleteImage(img: SavedImage) {
    if (!confirm(`Hapus "${img.name}"? Hasil analisis dan konten terkait juga ikut terhapus.`)) return;
    try {
      const res = await fetch(`/api/images?id=${img.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menghapus.");
      setNotice(`"${img.name}" dihapus.`);
      await loadImages();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Gagal menghapus."]);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Image Upload</h1>
        <p className="text-sm text-slate-500">
          Unggah gambar produk (JPG, JPEG, PNG, WEBP, maks. {MAX_MB} MB per file).
        </p>
      </header>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white px-6 py-12 text-center transition ${
          dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:border-indigo-400"
        }`}
      >
        <UploadCloud className="mb-3 text-indigo-500" size={40} />
        <p className="font-medium text-slate-800">Seret gambar ke sini, atau klik untuk memilih</p>
        <p className="mt-1 text-xs text-slate-500">Bisa memilih beberapa gambar sekaligus</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {errors.length > 0 && (
        <div className="space-y-1 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
          {errors.map((m, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{m}</span>
            </div>
          ))}
        </div>
      )}

      {notice && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700 ring-1 ring-emerald-200">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      )}

      {pending.length > 0 && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Siap disimpan ({pending.length})
            </h2>
            <button
              onClick={uploadAll}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {busy ? "Menyimpan..." : "Simpan semua"}
            </button>
          </div>

          <ul className="space-y-4">
            {pending.map((p) => (
              <li key={p.key} className="flex gap-4 rounded-xl bg-slate-50 p-3">
                <img
                  src={p.preview}
                  alt={p.name}
                  className="h-24 w-24 shrink-0 rounded-lg object-cover"
                />
                <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-slate-500">
                    Nama gambar
                    <input
                      value={p.name}
                      maxLength={100}
                      disabled={busy}
                      onChange={(e) => patchPending(p.key, { name: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-500">
                    Kategori
                    <select
                      value={p.categoryId}
                      disabled={busy}
                      onChange={(e) => patchPending(p.key, { categoryId: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      <option value="">Tanpa kategori</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="text-xs text-slate-500 sm:col-span-2">
                    {p.file.name} • {formatBytes(p.file.size)}
                    {p.status === "uploading" && (
                      <span className="ml-2 inline-flex items-center gap-1 text-indigo-600">
                        <Loader2 size={12} className="animate-spin" /> mengunggah...
                      </span>
                    )}
                    {p.status === "error" && (
                      <span className="ml-2 text-rose-600">{p.message}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removePending(p.key)}
                  disabled={busy}
                  title="Batalkan"
                  className="h-8 w-8 shrink-0 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X size={16} className="mx-auto" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Gambar tersimpan ({saved.length})
        </h2>
        {saved.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-sm text-slate-500 ring-1 ring-slate-200">
            Belum ada gambar tersimpan.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {saved.map((img) => (
              <div
                key={img.id}
                className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
              >
                <img
                  src={`/api/image-file?id=${img.id}&size=small`}
                  alt={img.name}
                  loading="lazy"
                  className="h-44 w-full object-cover"
                />
                <div className="space-y-1 p-4">
                  <div className="truncate font-semibold text-slate-900" title={img.name}>
                    {img.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {img.category_name ?? "Tanpa kategori"} • {formatBytes(img.size_bytes)}
                    {img.width && img.height ? ` • ${img.width}×${img.height}` : ""}
                  </div>
                  <div className="text-xs text-slate-400">{formatDate(img.created_at)}</div>
                  <button
                    onClick={() => deleteImage(img)}
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 size={14} /> Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
