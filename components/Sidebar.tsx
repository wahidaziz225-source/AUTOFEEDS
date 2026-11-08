"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap } from "lucide-react";

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
        <Zap size={22} />
      </div>
      <div>
        <div className="text-lg font-bold tracking-wide text-white">AUTOfEEDS</div>
        <div className="text-xs text-slate-400">Studio promosi produk</div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const active = pathname === "/express" || pathname.startsWith("/express/");

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center bg-[#0b1437] px-4 lg:hidden">
        <Link href="/express" aria-label="AUTOfEEDS Express" className="rounded-lg">
          <Brand />
        </Link>
      </header>

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 shrink-0 flex-col bg-[#0b1437] text-slate-300 lg:flex">
        <div className="px-6 py-7">
          <Link href="/express" aria-label="AUTOfEEDS Express" className="rounded-lg">
            <Brand />
          </Link>
        </div>
        <nav aria-label="Navigasi utama" className="flex-1 px-3">
          <Link
            href="/express"
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
              active ? "bg-indigo-500/20 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Zap size={18} />
            Auto Feeds Express
          </Link>
        </nav>
        <div className="px-6 py-5 text-xs text-slate-500">
          Berjalan lokal • Data tersimpan di komputer Anda
        </div>
      </aside>
    </>
  );
}
