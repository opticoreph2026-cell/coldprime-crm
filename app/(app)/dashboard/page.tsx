"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { DashboardStats } from "@/lib/types";
import { PageHeader, ErrorBanner, Card, EmptyState, Badge } from "@/components/ui";

const peso = (v: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(v);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

const TYPE_ICONS: Record<string, string> = {
  CALL: "📞", EMAIL: "✉️", MEETING: "🤝", SITE_VISIT: "🚚", FOLLOW_UP: "🔔",
  QUOTATION: "📄", PROPOSAL: "📑", OTHER: "📌",
};

function SetupChecklist({ stats }: { stats: DashboardStats }) {
  // Render nothing until localStorage has been read (avoids flashing the
  // step buttons on every load before dismissal state is known).
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setDismissed(localStorage.getItem("cp_setup_dismissed") === "1");
    setReady(true);
  }, []);
  if (!ready || dismissed) return null;

  const steps = [
    { label: "Add your first company", href: "/companies", done: stats.totalCompanies > 0 },
    { label: "Add contacts to your companies", href: "/contacts", done: stats.totalContacts > 0 },
    { label: "Create a lead to start your pipeline", href: "/leads", done: stats.totalLeads > 0 },
    { label: "Log an activity or follow-up", href: "/activities", done: stats.totalActivities > 0 },
    { label: "Create an email template", href: "/email-templates", done: stats.totalEmailTemplates > 0 },
    { label: "Add an HVAC/IAQ vendor", href: "/vendors", done: stats.totalVendors > 0 },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  const dismiss = () => { localStorage.setItem("cp_setup_dismissed", "1"); setDismissed(true); };

  return (
    <Card style={{ marginBottom: 24 }}>
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-base font-semibold">Get started — {doneCount}/{steps.length} done</h2>
        <button className="btn btn-ghost px-2 py-1 text-xs" onClick={dismiss}>Dismiss</button>
      </div>
      <p className="text-xs text-slate-400 mb-3">Finish these steps to unlock the full Coldprime workflow.</p>
      <div className="grid grid-cols-[repeat(auto-fill,_minmax(240px,_1fr))] gap-2">
        {steps.map((s) => (
          <Link
            key={s.label}
            href={s.href} className={`flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 text-[12.8px] no-underline ${s.done ? "text-green-800 bg-green-50" : "text-slate-900 bg-white"}`}
          >
            <span>{s.done ? "✅" : "⬜"}</span>
            <span className={`${s.done ? "line-through opacity-70" : "no-underline opacity-100"}`}>{s.label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");
  const branchName = session?.user?.branchName || "All Branches";

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load dashboard");
        return r.json();
      })
      .then(setStats)
      .catch((e) => setError(e.message || "Failed to load dashboard"));
  }, []);

  if (error) return (
    <div className="page">
      <ErrorBanner message={error}>
        <button className="btn btn-primary" onClick={() => { setError(""); setStats(null); window.location.reload(); }}>Retry</button>
      </ErrorBanner>
    </div>
  );

  if (!stats) return <div className="page"><p className="text-slate-500">Loading dashboard...</p></div>;

  const cards = [
    { label: "Pipeline Value", value: peso(stats.pipelineTotal), color: "#1e40af", sub: `${stats.activeLeads} open leads` },
    { label: "Follow-Ups Due Today", value: stats.followUpsDueToday, color: stats.followUpsDueToday > 0 ? "#c2410c" : "#15803d", sub: stats.overdueFollowUps > 0 ? `${stats.overdueFollowUps} overdue` : "on track", subColor: stats.overdueFollowUps > 0 ? "#dc2626" : undefined },
    { label: "Accreditations Pending", value: stats.accreditationsPending, color: "#7c3aed", sub: "docs submitted / under review" },
    { label: "Upcoming Follow-Ups", value: stats.upcomingFollowUps, color: "#0f766e", sub: "next 7 days" },
    { label: "This Week", value: stats.activitiesThisWeek, color: "#0e7490", sub: `${stats.newLeadsThisWeek} new leads since Monday` },
    { label: "Total Companies", value: stats.totalCompanies, color: "#334155" },
    { label: "Total Contacts", value: stats.totalContacts, color: "#334155" },
    { label: "Active Leads", value: stats.activeLeads, color: "#334155" },
    { label: "Active Projects", value: stats.activeProjects, color: "#334155" },
  ];

  const maxPipeline = Math.max(...stats.pipelineByStatus.map((p) => p.value), 1);

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        subtitle={`Coldprime Enterprises Corporation — ${branchName}`}
        actions={
          <span className="text-slate-500 self-center text-[12.8px]">
            This month: <strong>{stats.activitiesThisMonth}</strong> activities · <strong>{stats.newLeadsThisMonth}</strong> new leads
          </span>
        }
      />

      <div className="page-scroll">
      <SetupChecklist stats={stats} />

      <div className="responsive-grid grid grid-cols-4 gap-4 mb-6">
        {cards.map((card) => (
          <Card key={card.label} padding={20}>
            <div className="text-slate-500 uppercase tracking-wider text-[11.2px]">
              {card.label}
            </div>
            <div className="text-[28px] font-bold mt-1" style={{ color: card.color }}>
              {typeof card.value === "string" ? card.value : card.value.toLocaleString()}
            </div>
            {card.sub && (
              <div className="mt-1 text-[11.52px]" style={{ color: card.subColor || "#94a3b8" }}>{card.sub}</div>
            )}
          </Card>
        ))}
      </div>

      <div className="responsive-split grid grid-cols-[2fr_1fr] gap-4 mb-6">
        <Card>
          <h2 className="text-base font-semibold mb-1">Pipeline Value by Status</h2>
          <p className="text-xs text-slate-400 mb-4">Estimated value of open leads, excluding completed/cancelled.</p>
          {stats.pipelineByStatus.length === 0 ? (
            <EmptyState message="No open leads with estimated values yet." />
          ) : (
            <div className="flex flex-col gap-2.5">
              {stats.pipelineByStatus.map((p) => (
                <div key={p.status}>
                  <div className="flex justify-between mb-[3px] text-[12.8px]">
                    <span className="font-medium">{p.status} <span className="text-slate-400">({p.count})</span></span>
                    <span className="font-semibold text-blue-800">{peso(p.value)}</span>
                  </div>
                  <div className="bg-slate-100 overflow-hidden h-2 rounded">
                    <div className="h-full bg-blue-800 rounded" style={{ width: `${Math.max(2, (p.value / maxPipeline) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-base font-semibold mb-4">Projects by Status</h2>
          {stats.projectsByStatus.length === 0 ? (
            <EmptyState message="No projects yet." />
          ) : (
            <div className="flex gap-2 flex-wrap">
              {stats.projectsByStatus.map((p) => (
                <div key={p.status} className="px-3 py-[6.4px] bg-slate-100 rounded-md text-[12.8px]">
                  <span className="font-semibold">{p.count}</span>{" "}
                  <span className="text-slate-500">{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold">Recent Activity</h2>
          <Link href="/activities" className="text-[12.8px] text-blue-800">View all →</Link>
        </div>
        {stats.recentActivities.length === 0 ? (
            <EmptyState message="No activities logged yet." />
        ) : (
          <div className="flex flex-col">
            {stats.recentActivities.map((a, i) => {
              const overdue = a.nextFollowUp && new Date(a.nextFollowUp) < new Date();
              return (
                <div key={a.id} className={`${`flex items-center gap-3 ${i === 0 ? "border-t-0" : "border-t border-t-slate-100"}`} px-0 py-2.5`}>
                  <span className="text-base text-center w-6">{TYPE_ICONS[a.type] || "📌"}</span>
                  <span className="text-xs text-slate-500 whitespace-nowrap w-14">{fmtDate(a.date)}</span>
                  <Badge color="gray" title={a.type}>{a.type.replace(/_/g, " ")}</Badge>
                  <span className="flex-1 text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap text-[13.6px]">
                    {a.description || "—"}
                    {(a.company || a.project) && (
                      <span className="text-slate-500"> · {a.company?.name || a.project?.projectName}</span>
                    )}
                  </span>
                  {a.nextFollowUp && (
                    <span className={`${`whitespace-nowrap ${overdue ? "text-red-600 font-semibold" : "text-teal-700 font-normal"}`} text-[11.52px]`}>
                      {overdue ? "overdue " : "next "}{fmtDate(a.nextFollowUp)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
      </div>
    </div>
  );
}
