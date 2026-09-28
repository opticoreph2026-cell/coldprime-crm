"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { PageHeader, LoadingState, ErrorBanner, Badge } from "@/components/ui";
import {
  addDaysISO,
  currentWeekRange,
  mondayOf,
  todayPH,
} from "@/lib/dates";
import { KPI_KEYS, KPI_LABELS } from "@/lib/reports/kpi-map";
import type { WeeklyReport } from "@/lib/reports/weekly";

type Preset = "this-week" | "last-week" | "last-2-weeks" | "this-month" | "last-month" | "custom";

const PRESETS: { id: Exclude<Preset, "custom">; label: string }[] = [
  { id: "this-week", label: "This week" },
  { id: "last-week", label: "Last week" },
  { id: "last-2-weeks", label: "Last 2 weeks" },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
];

function presetRange(p: Exclude<Preset, "custom">): { from: string; to: string } {
  const thisWeek = currentWeekRange();
  switch (p) {
    case "this-week":
      return thisWeek;
    case "last-week":
      return { from: addDaysISO(thisWeek.from, -7), to: addDaysISO(thisWeek.to, -7) };
    case "last-2-weeks":
      return { from: addDaysISO(thisWeek.from, -14), to: thisWeek.to };
    case "this-month": {
      const today = todayPH();
      const [y, m] = today.split("-").map(Number);
      const first = `${y}-${String(m).padStart(2, "0")}-01`;
      const nextFirst = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      return { from: first, to: addDaysISO(nextFirst, -1) };
    }
    case "last-month": {
      const today = todayPH();
      const firstThis = `${today.slice(0, 7)}-01`;
      const lastPrev = addDaysISO(firstThis, -1);
      return { from: `${lastPrev.slice(0, 7)}-01`, to: lastPrev };
    }
  }
}

interface Option {
  id: string;
  name: string;
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const isStaff = session?.user?.role === "STAFF";

  const initial = currentWeekRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [preset, setPreset] = useState<Preset>("this-week");
  const [userId, setUserId] = useState(""); // "" = Everyone (admins) / Me (staff)
  const [users, setUsers] = useState<Option[]>([]);

  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<"" | "pdf" | "xlsx">("");

  const [highlights, setHighlights] = useState("");
  const [blockers, setBlockers] = useState("");
  const [noteTouched, setNoteTouched] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  const valid = from <= to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to);
  const singleWeek = valid && mondayOf(from) === mondayOf(to);

  const fetchReport = useCallback(async () => {
    if (!valid) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from, to, format: "json" });
      if (!isStaff && userId) params.set("userId", userId);
      const res = await fetch(`/api/reports/weekly?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to load report (${res.status})`);
      setReport(data);
      if (!noteTouched) {
        setHighlights(data.myNote?.highlights || "");
        setBlockers(data.myNote?.blockers || "");
      }
    } catch (e) {
      setReport(null);
      setError(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [from, to, userId, isStaff, valid, noteTouched]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Admins get a person dropdown; staff always see "Me".
  useEffect(() => {
    if (isStaff) return;
    (async () => {
      try {
        const res = await fetch("/api/users");
        const data = await res.json();
        setUsers((data.data || []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
      } catch {
        setUsers([]);
      }
    })();
  }, [isStaff]);

  const applyPreset = (p: Exclude<Preset, "custom">) => {
    const r = presetRange(p);
    setPreset(p);
    setFrom(r.from);
    setTo(r.to);
    setNoteTouched(false);
  };

  const exportFile = async (fmt: "pdf" | "xlsx") => {
    if (!valid) return;
    setExporting(fmt);
    try {
      const params = new URLSearchParams({ from, to, format: fmt });
      if (!isStaff && userId) params.set("userId", userId);
      const res = await fetch(`/api/reports/weekly?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `Weekly_Accomplishment_${from}_to_${to}.${fmt}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${fmt.toUpperCase()} downloaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting("");
    }
  };

  const saveNote = async () => {
    if (!singleWeek) return;
    setNoteSaving(true);
    try {
      const res = await fetch("/api/reports/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: mondayOf(from), highlights, blockers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save note");
      toast.success("Weekly note saved");
      setNoteTouched(false);
      fetchReport();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save note");
    } finally {
      setNoteSaving(false);
    }
  };

  const labelStyle: React.CSSProperties = { fontSize: "0.75rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase" as const };
  const inputStyle: React.CSSProperties = { padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: "0.875rem", background: "#fff" };

  return (
    <div className="page">
      <PageHeader
        title="Weekly Accomplishment Report"
        subtitle="Preview on screen first, then export to PDF or Excel"
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => exportFile("pdf")} disabled={!valid || loading || exporting !== ""}>
              {exporting === "pdf" ? "Preparing..." : "Download PDF"}
            </button>
            <button className="btn btn-primary" onClick={() => exportFile("xlsx")} disabled={!valid || loading || exporting !== ""}>
              {exporting === "xlsx" ? "Preparing..." : "Download Excel"}
            </button>
          </>
        }
      />

      <div className="page-scroll">
        {error && <ErrorBanner message={error} />}

        {/* Controls */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                className={preset === p.id ? "btn btn-secondary" : "btn btn-ghost"}
                style={{ fontSize: "0.8125rem", padding: "5px 12px" }}
                onClick={() => applyPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
            <span style={{ alignSelf: "center", fontSize: "0.8125rem", color: "#94a3b8" }}>Custom</span>
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <div style={labelStyle}>From</div>
              <input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); setNoteTouched(false); }} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>To</div>
              <input type="date" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPreset("custom"); setNoteTouched(false); }} style={inputStyle} />
            </div>
            {!isStaff && (
              <div>
                <div style={labelStyle}>Person</div>
                <select value={userId} onChange={(e) => setUserId(e.target.value)} style={inputStyle}>
                  <option value="">Everyone</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {isStaff && (
              <div>
                <div style={labelStyle}>Person</div>
                <div style={{ ...inputStyle, background: "#f1f5f9", color: "#475569" }}>Me</div>
              </div>
            )}
            {!valid && <span style={{ color: "#dc2626", fontSize: "0.8125rem" }}>&quot;From&quot; must be on or before &quot;To&quot;</span>}
          </div>
        </div>

        {loading && !report && <LoadingState message="Loading report..." />}

        {report && !loading && (
          <>
            {/* Totals */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>
                Totals{" "}
                <span style={{ fontWeight: 400, color: "#64748b", fontSize: "0.8125rem" }}>
                  {report.scope.branchName} | {report.scope.userName || "Everyone"} | {report.range.from} to {report.range.to}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                {KPI_KEYS.map((k) => (
                  <div key={k} style={{ background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{KPI_LABELS[k]}</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: report.totals[k] > 0 ? "#1f3864" : "#94a3b8" }}>{report.totals[k]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Week-by-week table */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Week by week</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #e2e8f0", position: "sticky", left: 0, background: "#fff" }}>Week</th>
                      {KPI_KEYS.map((k) => (
                        <th key={k} style={{ textAlign: "right", padding: "8px 10px", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{KPI_LABELS[k]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.weeks.map((w) => (
                      <tr key={w.label}>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap", position: "sticky", left: 0, background: "#fff" }}>{w.label}</td>
                        {KPI_KEYS.map((k) => (
                          <td key={k} style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid #f1f5f9", color: w.kpis[k] > 0 ? "#1f3864" : "#cbd5e1", fontWeight: w.kpis[k] > 0 ? 600 : 400 }}>
                            {w.kpis[k]}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr style={{ background: "#f8fafc" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 700, position: "sticky", left: 0, background: "#f8fafc" }}>TOTAL</td>
                      {KPI_KEYS.map((k) => (
                        <td key={k} style={{ textAlign: "right", padding: "8px 10px", fontWeight: 700 }}>{report.totals[k]}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Weekly note (single-week ranges only) */}
            {singleWeek && (
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Weekly note</div>
                <div style={{ fontSize: "0.8125rem", color: "#64748b", marginBottom: 10 }}>
                  Highlights and blockers for {mondayOf(from)}
                  {report.myNote?.userName ? ` (saved by ${report.myNote.userName})` : ""}
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <div style={labelStyle}>Highlights</div>
                    <textarea
                      value={highlights}
                      onChange={(e) => { setHighlights(e.target.value); setNoteTouched(true); }}
                      rows={3}
                      style={{ ...inputStyle, width: "100%", resize: "vertical" }}
                      placeholder="What went well this week..."
                    />
                  </div>
                  <div>
                    <div style={labelStyle}>Blockers</div>
                    <textarea
                      value={blockers}
                      onChange={(e) => { setBlockers(e.target.value); setNoteTouched(true); }}
                      rows={2}
                      style={{ ...inputStyle, width: "100%", resize: "vertical" }}
                      placeholder="What held things up..."
                    />
                  </div>
                  <div>
                    <button className="btn btn-primary" onClick={saveNote} disabled={noteSaving}>
                      {noteSaving ? "Saving..." : "Save note"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Limitations */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                <Badge color="yellow">Note</Badge>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Data limitations</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: "#64748b", fontSize: "0.8125rem" }}>
                {report.limitations.map((l) => (
                  <li key={l} style={{ marginBottom: 4 }}>{l}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
