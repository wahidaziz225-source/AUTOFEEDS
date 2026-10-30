"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  ScanSearch,
  Sparkles,
  Megaphone,
  Library,
  History,
  Settings,
  Zap,
} from "lucide-react";

const MENU = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/upload", label: "Image Upload", icon: Upload },
  { href: "/analyzer", label: "AI Image Analyzer", icon: ScanSearch },
  { href: "/content-studio", label: "Content Studio", icon: Sparkles },
  { href: "/promo", label: "Promo Composer", icon: Megaphone },
  { href: "/library", label: "Content Library", icon: Library },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-[#0b1437] text-slate-300">
      <div className="flex items-center gap-3 px-6 py-7">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
          <Zap size={22} />
        </div>
        <div>
          <div className="text-lg font-bold tracking-wide text-white">
            AUTOfEEDS
          </div>
          <div className="text-xs text-slate-400">From Image to Content.</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {MENU.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
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
      </nav>

      <div className="px-6 py-5 text-xs text-slate-500">
        Berjalan lokal • Data tersimpan di komputer Anda
      </div>
    </aside>
  );
}