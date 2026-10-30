import { connection } from "next/server";
import { ImageIcon, Sparkles, MessageSquareText, ScanSearch } from "lucide-react";
import { getStats, getOllamaStatus } from "@/lib/stats";
import { getSetting } from "@/lib/db";

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
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
      <span className="font-medium text-slate-700">{name}</span>
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          ready ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
        }`}
      >
        {ready ? "Terpasang" : "Belum ada"}
      </span>
    </div>
  );
}

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
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500">
          Ringkasan aktivitas dan status AI di AUTOfEEDS.
        </p>
      </header>

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

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Aktivitas Terbaru
          </h2>
          {stats.recent.length === 0 ? (
            <p className="text-sm text-slate-500">
              Belum ada aktivitas. Mulai dengan mengunggah gambar.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.recent.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-medium text-slate-700">{a.action}</span>
                  <span className="text-slate-400">{a.created_at}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Status AI</h2>
          <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <span className="font-medium text-slate-700">Koneksi Ollama</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                ollama.online
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-rose-100 text-rose-700"
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
              Ollama tidak terdeteksi. Buka aplikasi Ollama dari menu Start,
              lalu muat ulang halaman ini.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}