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
        <div className="bg-white border border-slate-200 mb-5 rounded-[10px] p-4">
          <div className="flex gap-2 flex-wrap mb-3">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                className={`${preset === p.id ? "btn btn-secondary" : "btn btn-ghost"} text-[13px] px-3 py-[5px]`}
                onClick={() => applyPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
            <span className="self-center text-[13px] text-slate-400">Custom</span>
          </div>

          <div className="flex gap-4 flex-wrap items-end">
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
            {!valid && <span className="text-red-600 text-[13px]">&quot;From&quot; must be on or before &quot;To&quot;</span>}
          </div>
        </div>

        {loading && !report && <LoadingState message="Loading report..." />}

        {report && !loading && (
          <>
            {/* Totals */}
            <div className="bg-white border border-slate-200 mb-5 rounded-[10px] p-4">
              <div className="font-bold mb-3">
                Totals{" "}
                <span className="font-normal text-slate-500 text-[13px]">
                  {report.scope.branchName} | {report.scope.userName || "Everyone"} | {report.range.from} to {report.range.to}
                </span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,_minmax(150px,_1fr))] gap-2">
                {KPI_KEYS.map((k) => (
                  <div key={k} className="bg-slate-50 border border-[#eef2f7] px-2.5 py-2 rounded-lg">
                    <div className="text-slate-500 text-[11.2px]">{KPI_LABELS[k]}</div>
                    <div className={`${`font-bold ${report.totals[k] > 0 ? "text-[#1f3864]" : "text-slate-400"}`} text-[17.6px]`}>{report.totals[k]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Week-by-week table */}
            <div className="bg-white border border-slate-200 mb-5 rounded-[10px] p-4">
              <div className="font-bold mb-3">Week by week</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left px-2.5 py-2 border-b-2 border-b-slate-200 sticky left-0 bg-white">Week</th>
                      {KPI_KEYS.map((k) => (
                        <th key={k} className="text-right px-2.5 py-2 border-b-2 border-b-slate-200 whitespace-nowrap">{KPI_LABELS[k]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.weeks.map((w) => (
                      <tr key={w.label}>
                        <td className="px-2.5 py-2 border-b border-b-slate-100 whitespace-nowrap sticky left-0 bg-white">{w.label}</td>
                        {KPI_KEYS.map((k) => (
                          <td key={k} className={`text-right px-2.5 py-2 border-b border-b-slate-100 ${w.kpis[k] > 0 ? "text-[#1f3864] font-semibold" : "text-slate-300 font-normal"}`}>
                            {w.kpis[k]}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="bg-slate-50">
                      <td className="px-2.5 py-2 font-bold sticky left-0 bg-slate-50">TOTAL</td>
                      {KPI_KEYS.map((k) => (
                        <td key={k} className="text-right px-2.5 py-2 font-bold">{report.totals[k]}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Weekly note (single-week ranges only) */}
            {singleWeek && (
              <div className="bg-white border border-slate-200 mb-5 rounded-[10px] p-4">
                <div className="font-bold mb-1">Weekly note</div>
                <div className="text-[13px] text-slate-500 mb-2.5">
                  Highlights and blockers for {mondayOf(from)}
                  {report.myNote?.userName ? ` (saved by ${report.myNote.userName})` : ""}
                </div>
                <div className="grid gap-2.5">
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
            <div className="mb-6">
              <div className="flex gap-1.5 items-center mb-2">
                <Badge color="yellow">Note</Badge>
                <span className="text-[13px] font-semibold">Data limitations</span>
              </div>
              <ul className="pl-[18px] text-slate-500 text-[13px] m-0">
                {report.limitations.map((l) => (
                  <li key={l} className="mb-1">{l}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
