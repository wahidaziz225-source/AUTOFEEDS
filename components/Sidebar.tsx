"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  ScanSearch,
  ImagePlus,
  PenTool,
  Palette,
  Sparkles,
  Megaphone,
  Library,
  History,
  Settings,
  Zap,
  Menu,
  X,
} from "lucide-react";

type Item = { href: string; label: string; icon: React.ComponentType<{ size?: number }> };

// Dikelompokkan sesuai alur kerja: unggah → analisis → konten/desain → kelola
const GROUPS: { title: string | null; items: Item[] }[] = [
  {
    title: null,
    items: [{ href: "/dashboard", label: "Overview", icon: LayoutDashboard }],
  },
  {
    title: "Alur kerja",
    items: [
      { href: "/upload", label: "Image Upload", icon: Upload },
      { href: "/image-studio", label: "Product Image Studio", icon: ImagePlus },
      { href: "/analyzer", label: "AI Image Analyzer", icon: ScanSearch },
      { href: "/content-studio", label: "Content Studio", icon: Sparkles },
      { href: "/promo", label: "Promo Composer", icon: Megaphone },
      { href: "/editor", label: "Design Editor", icon: PenTool },
    ],
  },
  {
    title: "Kelola",
    items: [
      { href: "/library", label: "Content Library", icon: Library },
      { href: "/history", label: "History", icon: History },
      { href: "/brand-kit", label: "Brand Kit", icon: Palette },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
        <Zap size={22} />
      </div>
      <div>
        <div className="text-lg font-bold tracking-wide text-white">AUTOfEEDS</div>
        <div className="text-xs text-slate-400">From Image to Content.</div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Bilah atas khusus layar kecil */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between bg-[#0b1437] px-4 lg:hidden">
        <Brand />
        <button
          type="button"
          aria-label="Buka menu"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <Menu size={22} />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col overflow-y-auto bg-[#0b1437] text-slate-300 transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-7">
          <Brand />
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 px-3">
          {GROUPS.map((g, i) => (
            <div key={g.title ?? i}>
              {g.title && (
                <div className="mb-1 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {g.title}
                </div>
              )}
              <div className="space-y-1">
                {g.items.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                        active
                          ? "bg-indigo-500/20 text-white"
                          : "hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon size={18} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-6 py-5 text-xs text-slate-500">
          Berjalan lokal • Data tersimpan di komputer Anda
        </div>
      </aside>
    </>
  );
}
