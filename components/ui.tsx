import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";

// Komponen tampilan bersama. Tanpa state, jadi bisa dipakai di halaman server maupun client.

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 ${className}`}>
      {children}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200"
    >
      <AlertCircle size={18} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function LoadingState({ label = "Memuat..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
      <Loader2 size={16} className="animate-spin" /> {label}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  href,
  actionLabel,
}: {
  title: string;
  description?: string;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {href && actionLabel && (
        <Link
          href={href}
          className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
