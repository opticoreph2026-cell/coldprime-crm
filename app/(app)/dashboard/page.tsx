"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { DashboardStats } from "@/lib/types";
import { PageHeader, ErrorBanner, Card, EmptyState, Badge, Button } from "@/components/ui";

const peso = (v: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(v);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

const TYPE_ICONS: Record<string, string> = {
  CALL: "📞", EMAIL: "✉️", MEETING: "🤝", SITE_VISIT: "🚚", FOLLOW_UP: "🔔",
  QUOTATION: "📄", PROPOSAL: "📑", OTHER: "📌",
};

const CARD_COLORS: Record<string, { bg: string; text: string; sub: string }> = {
  pipeline: { bg: "#eef4ff", text: "#014486", sub: "#0176d3" },
  followups: { bg: "#fdf3e1", text: "#8a4b04", sub: "#a96404" },
  accreditations: { bg: "#f3eaff", text: "#5c1f99", sub: "#7526e3" },
  upcoming: { bg: "#ebf7e6", text: "#1d6b34", sub: "#2e844a" },
  week: { bg: "#eef4ff", text: "#014486", sub: "#0176d3" },
  default: { bg: "#f3f3f3", text: "#5c5c5c", sub: "#5c5c5c" },
};

function SetupChecklist({ stats }: { stats: DashboardStats }) {
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
    <Card className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-[13px] font-semibold text-ink">Get started — {doneCount}/{steps.length} done</h2>
        <Button variant="ghost" size="sm" onClick={dismiss}>Dismiss</Button>
      </div>
      <p className="text-[12px] text-ink-muted mb-3">Finish these steps to unlock the full Coldprime workflow.</p>
      <div className="grid grid-cols-[repeat(auto-fill,_minmax(220px,_1fr))] gap-2">
        {steps.map((s) => (
          <Link
            key={s.label}
            href={s.href} className={`flex items-center gap-2 px-3 py-2 rounded border ${s.done
              ? "border-[#bbf7d0] bg-[#ebf7e6] text-[#1d6b34]"
              : "border-line bg-white text-ink hover:bg-shell"
            } no-underline`}
          >
            <span>{s.done ? "✅" : "⬜"}</span>
            <span className={s.done ? "line-through opacity-70" : "no-underline opacity-100"}>{s.label}</span>
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
        <Button variant="primary" onClick={() => { setError(""); setStats(null); window.location.reload(); }}>Retry</Button>
      </ErrorBanner>
    </div>
  );

  if (!stats) return <div className="page page-scroll"><p className="text-ink-muted">Loading dashboard…</p></div>;

  const cards = [
    { key: "pipeline", label: "Pipeline Value", value: peso(stats.pipelineTotal), sub: `${stats.activeLeads} open leads` },
    { key: "followups", label: "Follow-Ups Due Today", value: stats.followUpsDueToday.toLocaleString(), sub: stats.overdueFollowUps > 0 ? `${stats.overdueFollowUps} overdue` : "on track" },
    { key: "accreditations", label: "Accreditations Pending", value: stats.accreditationsPending.toLocaleString(), sub: "docs submitted / under review" },
    { key: "upcoming", label: "Upcoming Follow-Ups", value: stats.upcomingFollowUps.toLocaleString(), sub: "next 7 days" },
    { key: "week", label: "This Week", value: stats.activitiesThisWeek.toLocaleString(), sub: `${stats.newLeadsThisWeek} new leads since Monday` },
    { key: "companies", label: "Total Companies", value: stats.totalCompanies.toLocaleString(), sub: "" },
    { key: "contacts", label: "Total Contacts", value: stats.totalContacts.toLocaleString(), sub: "" },
    { key: "leads", label: "Active Leads", value: stats.activeLeads.toLocaleString(), sub: "" },
    { key: "projects", label: "Active Projects", value: stats.activeProjects.toLocaleString(), sub: "" },
  ];

  const maxPipeline = Math.max(...stats.pipelineByStatus.map((p) => p.value), 1);

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        subtitle={`Coldprime Enterprises Corporation — ${branchName}`}
        actions={
          <span className="text-[12px] text-ink-muted self-center">
            This month: <strong className="text-ink">{stats.activitiesThisMonth}</strong> activities · <strong className="text-ink">{stats.newLeadsThisMonth}</strong> new leads
          </span>
        }
      />

      <div className="page-scroll">
        <SetupChecklist stats={stats} />

        <div className="grid grid-cols-4 gap-3 mb-5">
          {cards.map((card) => {
            const theme = CARD_COLORS[card.key] ?? CARD_COLORS.default;
            return (
              <Card key={card.key} padding={16} className="bg-white border border-line rounded">
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">{card.label}</div>
                <div className="text-[24px] font-bold mt-1" style={{ color: theme.text }}>
                  {card.value}
                </div>
                {card.sub && (
                  <div className="mt-1 text-[12px]" style={{ color: theme.sub }}>{card.sub}</div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-[2fr_1fr] gap-3 mb-5">
          <Card padding={16} className="bg-white border border-line rounded">
            <div className="flex items-baseline gap-1 mb-3">
              <h2 className="text-[13px] font-semibold text-ink">Pipeline Value by Status</h2>
              <span className="text-[11px] text-ink-muted">open leads, excl. completed/cancelled</span>
            </div>
            {stats.pipelineByStatus.length === 0 ? (
              <EmptyState message="No open leads with estimated values yet." />
            ) : (
              <div className="flex flex-col gap-2">
                {stats.pipelineByStatus.map((p) => (
                  <div key={p.status} className="group">
                    <div className="flex justify-between mb-1 text-[12px]">
                      <span className="font-medium text-ink">{p.status} <span className="text-ink-muted">({p.count})</span></span>
                      <span className="font-semibold" style={{ color: "#0176d3" }}>{peso(p.value)}</span>
                    </div>
                    <div className="bg-[#ecebea] overflow-hidden h-1.5 rounded">
                      <div className="h-full bg-brand rounded" style={{ width: `${Math.max(2, (p.value / maxPipeline) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card padding={16} className="bg-white border border-line rounded">
            <h2 className="text-[13px] font-semibold text-ink mb-3">Projects by Status</h2>
            {stats.projectsByStatus.length === 0 ? (
              <EmptyState message="No projects yet." />
            ) : (
              <div className="flex gap-2 flex-wrap">
                {stats.projectsByStatus.map((p) => (
                  <div key={p.status} className="px-2.5 py-[5px] bg-[#ecebea] rounded text-[12px]">
                    <span className="font-medium text-ink">{p.count}</span>{" "}
                    <span className="text-ink-muted">{p.status}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card padding={16} className="bg-white border border-line rounded">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-[13px] font-semibold text-ink">Recent Activity</h2>
            <Link href="/activities" className="text-[12px] text-brand hover:text-brand-dark">View all →</Link>
          </div>
          {stats.recentActivities.length === 0 ? (
            <EmptyState message="No activities logged yet." />
          ) : (
            <div className="flex flex-col gap-1">
              {stats.recentActivities.map((a, i) => {
                const overdue = a.nextFollowUp && new Date(a.nextFollowUp) < new Date();
                return (
                  <div key={a.id} className={`flex items-start gap-2.5 py-2 ${i > 0 ? "border-t border-[#ecebea]" : ""}`}>
                    <span className="text-center w-6">{TYPE_ICONS[a.type] || "📌"}</span>
                    <span className="text-[11px] text-ink-muted whitespace-nowrap w-14">{fmtDate(a.date)}</span>
                    <Badge color="gray" title={a.type}>{a.type.replace(/_/g, " ")}</Badge>
                    <span className="flex-1 text-[13px] text-ink overflow-hidden text-ellipsis whitespace-nowrap">
                      {a.description || "—"}
                      {(a.company || a.project) && (
                        <span className="text-ink-muted"> · {a.company?.name || a.project?.projectName}</span>
                      )}
                    </span>
                    {a.nextFollowUp && (
                      <span className={`ml-2 whitespace-nowrap text-[12px] ${overdue ? "text-[#ba0517] font-semibold" : "text-[#0b827c] font-medium"}`}>
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
