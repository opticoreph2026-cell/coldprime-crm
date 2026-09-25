"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { DashboardStats } from "@/lib/types";

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
    <div style={{ padding: 24 }}>
      <div style={{ background: "#fef2f2", color: "#dc2626", padding: 16, borderRadius: 8, marginBottom: 16, border: "1px solid #fecaca" }}>
        {error}
      </div>
      <button onClick={() => { setError(""); setStats(null); window.location.reload(); }} style={{ padding: "8px 16px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
        Retry
      </button>
    </div>
  );

  if (!stats) return <div style={{ padding: 24, color: "#64748b" }}>Loading dashboard...</div>;

  const cards = [
    { label: "Total Companies", value: stats.totalCompanies, color: "#1e40af" },
    { label: "Total Contacts", value: stats.totalContacts, color: "#0f766e" },
    { label: "Active Leads", value: stats.activeLeads, color: "#c2410c" },
    { label: "Active Projects", value: stats.activeProjects, color: "#7c3aed" },
    { label: "Upcoming Follow-Ups", value: stats.upcomingFollowUps, color: "#15803d" },
    { label: "Overdue Follow-Ups", value: stats.overdueFollowUps, color: "#dc2626" },
    { label: "Activities This Month", value: stats.activitiesThisMonth, color: "#0369a1" },
    { label: "New Leads This Month", value: stats.newLeadsThisMonth, color: "#a16207" },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Dashboard</h1>
        <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
          Coldprime Enterprises Corporation — {branchName}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        {cards.map((card) => (
          <div
            key={card.label}
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: "1.25rem",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {card.label}
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: card.color, marginTop: 4 }}>
              {card.value != null ? card.value.toLocaleString() : "-"}
            </div>
          </div>
        ))}
      </div>

      {stats.projectsByStatus.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", padding: 24 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Projects by Status</h2>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {stats.projectsByStatus.map((p) => (
              <div
                key={p.status}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#f1f5f9",
                  borderRadius: 6,
                  fontSize: "0.875rem",
                }}
              >
                <span style={{ fontWeight: 600 }}>{p.count}</span>{" "}
                <span style={{ color: "#64748b" }}>{p.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}