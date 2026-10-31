"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, EmptyState, ErrorBanner, LoadingState, PageHeader } from "@/components/ui";

type Activity = {
  id: number;
  action: string;
  entity_type: string | null;
  details: string | null;
  created_at: string;
};

type Page = { total: number; activities: Activity[] };

const PAGE = 50;

// Fungsi murni (tidak memanggil setState) supaya aman dipakai dari effect maupun tombol
async function fetchPage(offset: number): Promise<Page> {
  const res = await fetch(`/api/history?limit=${PAGE}&offset=${offset}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Gagal memuat riwayat.");
  return { total: data.total, activities: data.activities };
}

export default function HistoryPage() {
  const [items, setItems] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchPage(0)
      .then((p) => {
        if (!alive) return;
        setTotal(p.total);
        setItems(p.activities);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Gagal memuat riwayat.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function loadMore() {
    setLoading(true);
    setError("");
    try {
      const p = await fetchPage(items.length);
      setTotal(p.total);
      setItems((prev) => [...prev, ...p.activities]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat riwayat.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="History"
        description="Riwayat aktivitas: upload, analisis, konten, dan desain promo."
      />
      <ErrorBanner message={error} />

      <Card>
        {loading && items.length === 0 ? (
          <LoadingState label="Memuat riwayat..." />
        ) : items.length === 0 && !error ? (
          <EmptyState
            title="Belum ada aktivitas"
            description="Aktivitas akan muncul di sini setelah Anda mengunggah gambar."
            href="/upload"
            actionLabel="Unggah gambar"
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-slate-700">{a.action}</div>
                  {a.details && <div className="break-words text-slate-500">{a.details}</div>}
                </div>
                <span className="shrink-0 text-xs text-slate-400">{a.created_at}</span>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && items.length < total && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Muat lebih banyak ({items.length} dari {total})
          </button>
        )}
      </Card>
    </div>
  );
}
