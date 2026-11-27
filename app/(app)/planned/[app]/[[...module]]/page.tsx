import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { APPS } from "@/lib/apps";

export default async function PlannedPage({
  params,
}: {
  params: Promise<{ app: string; module?: string[] }>;
}) {
  const { app: appId, module } = await params;
  const app = APPS.find((candidate) => candidate.id === appId);

  if (!app || !app.planned) notFound();

  const moduleId = module?.[0];
  const tab = app.tabs.find((candidate) => candidate.id === moduleId) ?? app.tabs[0];
  const Icon = app.icon;

  return (
    <div className="page">
      <div className="page-center">
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <span
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: app.color }}
          >
            <Icon size={30} />
          </span>

          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
            {app.label}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{tab.label}</h1>

          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1 text-[12px] font-medium text-brand-dark">
            <CalendarClock size={13} />
            Planned — not available yet
          </div>

          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-muted">
            This module is part of the Coldprime build plan. It will appear here with its own
            list views, record pages, and permissions once its phase is delivered.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {app.tabs.map((candidate) => {
              const active = candidate.id === tab.id;
              return (
                <Link
                  key={candidate.id}
                  href={candidate.href}
                  className={`rounded border px-3 py-1.5 text-[12px] no-underline ${
                    active
                      ? "border-brand bg-brand-light font-semibold text-brand-dark"
                      : "border-line bg-white text-ink hover:bg-shell"
                  }`}
                >
                  {candidate.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard" className="btn btn-primary">
              <ArrowLeft size={15} /> Back to Home
            </Link>
            <Link href="/companies" className="btn btn-secondary">
              Go to Companies
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
