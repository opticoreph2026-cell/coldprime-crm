"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock, Search, X } from "lucide-react";
import type { AppDefinition } from "@/lib/apps";

const RECENTS_KEY = "cp_recent_apps";
const MAX_RECENTS = 4;

export function AppLauncher({
  open,
  onClose,
  apps,
  onSearch,
}: {
  open: boolean;
  onClose: () => void;
  apps: AppDefinition[];
  onSearch: () => void;
}) {
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      if (raw) setRecentIds(JSON.parse(raw) as string[]);
    } catch {
      setRecentIds([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const remember = (id: string) => {
    const next = [id, ...recentIds.filter((x) => x !== id)].slice(0, MAX_RECENTS);
    setRecentIds(next);
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
      // Local storage can be unavailable in private mode; recents are optional.
    }
    onClose();
  };

  const byId = new Map(apps.map((app) => [app.id, app]));
  const recentApps = recentIds
    .map((id) => byId.get(id))
    .filter((app): app is AppDefinition => Boolean(app));

  return (
    <div
      className="fixed inset-0 z-[70] bg-[rgba(24,24,24,0.45)]"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="App Launcher"
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute left-3 top-[54px] max-h-[calc(100vh-72px)] w-[min(700px,calc(100vw-24px))] overflow-y-auto rounded-lg border border-line bg-white shadow-[0_24px_48px_rgba(0,0,0,0.24)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-ink">App Launcher</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close app launcher"
            className="shell-icon-btn"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onSearch();
            }}
            className="mb-5 flex h-9 w-full items-center gap-2 rounded border border-line bg-shell px-3 text-[13px] text-ink-muted hover:bg-[#ecebea]"
          >
            <Search size={15} />
            Search Coldprime...
          </button>

          {recentApps.length > 0 && (
            <section className="mb-5">
              <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                <Clock size={12} /> Recently used
              </h3>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {recentApps.map((app) => (
                  <AppTile key={`recent-${app.id}`} app={app} onVisit={remember} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              All apps
            </h3>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {apps.map((app) => (
                <AppTile key={app.id} app={app} onVisit={remember} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function AppTile({ app, onVisit }: { app: AppDefinition; onVisit: (id: string) => void }) {
  const Icon = app.icon;
  return (
    <Link
      href={app.defaultHref}
      onClick={() => onVisit(app.id)}
      className="flex items-start gap-3 rounded-md border border-transparent p-2.5 no-underline transition hover:border-line hover:bg-shell"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
        style={{ backgroundColor: app.color }}
      >
        <Icon size={20} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-ink">{app.label}</span>
        <span className="block truncate text-[11px] leading-tight text-ink-muted">
          {app.description}
        </span>
        {app.planned && (
          <span className="mt-1 inline-block rounded bg-shell px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-muted">
            Planned
          </span>
        )}
      </span>
    </Link>
  );
}
