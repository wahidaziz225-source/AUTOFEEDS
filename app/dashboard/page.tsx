import Link from "next/link";
import { connection } from "next/server";
import {
  ImageIcon,
  Sparkles,
  MessageSquareText,
  ScanSearch,
  Upload,
  Megaphone,
  Zap,
  ArrowRight,
} from "lucide-react";
import { getStats, getOllamaStatus } from "@/lib/stats";
import { getSetting } from "@/lib/db";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const instant = false;

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number }>;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Icon size={18} />
        </span>
      </div>
      <div className="mt-3 text-3xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function ModelRow({ name, ready }: { name: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
      <span className="min-w-0 truncate font-medium text-slate-700">{name}</span>
      <span
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
          ready ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
        }`}
      >
        {ready ? "Terpasang" : "Belum ada"}
      </span>
    </div>
  );
}

const STEPS = [
  { n: 1, label: "Unggah foto produk", href: "/upload" },
  { n: 2, label: "Analisis gambar dengan AI", href: "/analyzer" },
  { n: 3, label: "Buat caption dan konten", href: "/content-studio" },
  { n: 4, label: "Susun poster promo", href: "/promo" },
];

export default async function DashboardPage() {
  await connection();
  const stats = getStats();
  const ollamaUrl = getSetting("ollama_url");
  const visionModel = getSetting("vision_model");
  const textModel = getSetting("text_model");
  const ollama = await getOllamaStatus(ollamaUrl);

  const hasModel = (m: string) =>
    ollama.models.some((x) => x === m || x.startsWith(m + ":") || x === m + ":latest");

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="Overview"
        description="Ringkasan aktivitas dan status AI di AUTOfEEDS."
        actions={
          <>
            <Link
              href="/express"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-bold text-white shadow-sm hover:brightness-110"
            >
              <Zap size={16} className="fill-white" /> Express (Isi → Upload)
            </Link>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <Upload size={16} /> Unggah
            </Link>
            <Link
              href="/promo"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100"
            >
              <Megaphone size={16} /> Promo Composer
            </Link>
          </>
        }
      />

      {/* Auto Feeds Express Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl ring-1 ring-white/10">
        <div className="relative z-10 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div className="space-y-1.5 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-black uppercase text-slate-950">
              <Zap size={12} className="fill-slate-950" /> Alur Cepat
            </span>
            <h2 className="text-xl font-extrabold sm:text-2xl">
              Auto Feeds Express: Isi Produk → Siap Upload
            </h2>
            <p className="text-sm text-slate-300">
              Buat poster promosi visual resolusi tinggi dan caption Instagram persuasif lengkap dengan hashtag dalam hitungan detik.
            </p>
          </div>
          <Link
            href="/express"
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:brightness-110 px-5 py-3 text-sm font-bold text-white shadow-lg transition"
          >
            Mulai Express <ArrowRight size={16} />
          </Link>
        </div>
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Gambar" value={stats.totalImages} icon={ImageIcon} />
        <StatCard label="Konten Dibuat" value={stats.totalContents} icon={Sparkles} />
        <StatCard
          label="Caption Tersimpan"
          value={stats.totalSavedCaptions}
          icon={MessageSquareText}
        />
        <StatCard label="Analisis AI" value={stats.totalAnalyses} icon={ScanSearch} />
      </section>

      {stats.totalImages === 0 && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Mulai dari sini</h2>
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n}>
                <Link
                  href={s.href}
                  className="flex h-full items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                    {s.n}
                  </span>
                  {s.label}
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Aktivitas Terbaru</h2>
          {stats.recent.length === 0 ? (
            <EmptyState
              title="Belum ada aktivitas"
              description="Mulai dengan mengunggah gambar produk."
              href="/upload"
              actionLabel="Unggah gambar"
            />
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {stats.recent.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="min-w-0 truncate font-medium text-slate-700">{a.action}</span>
                    <span className="shrink-0 text-slate-400">{a.created_at}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/history"
                className="mt-3 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Lihat semua riwayat
              </Link>
            </>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Status AI</h2>
          <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <span className="font-medium text-slate-700">Koneksi Ollama</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                ollama.online ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              }`}
            >
              {ollama.online ? "Terhubung" : "Tidak aktif"}
            </span>
          </div>
          <div className="space-y-2">
            <ModelRow name={visionModel} ready={hasModel(visionModel)} />
            <ModelRow name={textModel} ready={hasModel(textModel)} />
          </div>
          {!ollama.online && (
            <p className="mt-4 text-xs text-slate-500">
              Ollama tidak terdeteksi. Buka aplikasi Ollama dari menu Start, lalu muat ulang
              halaman ini.
            </p>
          )}
          <Link
            href="/settings"
            className="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Ubah pengaturan AI
          </Link>
        </Card>
      </section>
    </div>
  );
}
