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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>Get started — {doneCount}/{steps.length} done</h2>
        <button className="btn btn-ghost" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }} onClick={dismiss}>Dismiss</button>
      </div>
      <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: 12 }}>Finish these steps to unlock the full Coldprime workflow.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
        {steps.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 6,
              border: "1px solid #e2e8f0", fontSize: "0.8rem", textDecoration: "none",
              color: s.done ? "#166534" : "#0f172a", background: s.done ? "#f0fdf4" : "#fff",
            }}
          >
            <span>{s.done ? "✅" : "⬜"}</span>
            <span style={{ textDecoration: s.done ? "line-through" : "none", opacity: s.done ? 0.7 : 1 }}>{s.label}</span>
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

  if (!stats) return <div className="page"><p style={{ color: "#64748b" }}>Loading dashboard...</p></div>;

  const cards = [
    { label: "Pipeline Value", value: peso(stats.pipelineTotal), color: "#1e40af", sub: `${stats.activeLeads} open leads` },
    { label: "Follow-Ups Due Today", value: stats.followUpsDueToday, color: stats.followUpsDueToday > 0 ? "#c2410c" : "#15803d", sub: stats.overdueFollowUps > 0 ? `${stats.overdueFollowUps} overdue` : "on track", subColor: stats.overdueFollowUps > 0 ? "#dc2626" : undefined },
    { label: "Accreditations Pending", value: stats.accreditationsPending, color: "#7c3aed", sub: "docs submitted / under review" },
    { label: "Upcoming Follow-Ups", value: stats.upcomingFollowUps, color: "#0f766e", sub: "next 7 days" },
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
          <span style={{ fontSize: "0.8rem", color: "#64748b", alignSelf: "center" }}>
            This month: <strong>{stats.activitiesThisMonth}</strong> activities · <strong>{stats.newLeadsThisMonth}</strong> new leads
          </span>
        }
      />

      <div className="page-scroll">
      <SetupChecklist stats={stats} />

      <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {cards.map((card) => (
          <Card key={card.label} padding={20}>
            <div style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {card.label}
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: card.color, marginTop: 4 }}>
              {typeof card.value === "string" ? card.value : card.value.toLocaleString()}
            </div>
            {card.sub && (
              <div style={{ fontSize: "0.72rem", marginTop: 4, color: card.subColor || "#94a3b8" }}>{card.sub}</div>
            )}
          </Card>
        ))}
      </div>

      <div className="responsive-split" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 4 }}>Pipeline Value by Status</h2>
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: 16 }}>Estimated value of open leads, excluding completed/cancelled.</p>
          {stats.pipelineByStatus.length === 0 ? (
            <EmptyState message="No open leads with estimated values yet." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {stats.pipelineByStatus.map((p) => (
                <div key={p.status}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 3 }}>
                    <span style={{ fontWeight: 500 }}>{p.status} <span style={{ color: "#94a3b8" }}>({p.count})</span></span>
                    <span style={{ fontWeight: 600, color: "#1e40af" }}>{peso(p.value)}</span>
                  </div>
                  <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(2, (p.value / maxPipeline) * 100)}%`, background: "#1e40af", borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Projects by Status</h2>
          {stats.projectsByStatus.length === 0 ? (
            <EmptyState message="No projects yet." />
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {stats.projectsByStatus.map((p) => (
                <div key={p.status} style={{ padding: "0.4rem 0.75rem", background: "#f1f5f9", borderRadius: 6, fontSize: "0.8rem" }}>
                  <span style={{ fontWeight: 600 }}>{p.count}</span>{" "}
                  <span style={{ color: "#64748b" }}>{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>Recent Activity</h2>
          <Link href="/activities" style={{ fontSize: "0.8rem", color: "#1e40af" }}>View all →</Link>
        </div>
        {stats.recentActivities.length === 0 ? (
            <EmptyState message="No activities logged yet." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {stats.recentActivities.map((a, i) => {
              const overdue = a.nextFollowUp && new Date(a.nextFollowUp) < new Date();
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: "1rem", width: 24, textAlign: "center" }}>{TYPE_ICONS[a.type] || "📌"}</span>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", width: 56, whiteSpace: "nowrap" }}>{fmtDate(a.date)}</span>
                  <Badge color="gray" title={a.type}>{a.type.replace(/_/g, " ")}</Badge>
                  <span style={{ flex: 1, fontSize: "0.85rem", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.description || "—"}
                    {(a.company || a.project) && (
                      <span style={{ color: "#64748b" }}> · {a.company?.name || a.project?.projectName}</span>
                    )}
                  </span>
                  {a.nextFollowUp && (
                    <span style={{ fontSize: "0.72rem", whiteSpace: "nowrap", color: overdue ? "#dc2626" : "#0f766e", fontWeight: overdue ? 600 : 400 }}>
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
