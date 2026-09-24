"use client";

import { useEffect, useState, useCallback } from "react";

interface Lead {
  id: string;
  source: string | null;
  industry: string | null;
  status: string;
  priority: string;
  estimatedValue: number | null;
  lastContactDate: string | null;
  nextFollowUp: string | null;
  notes: string | null;
  dateAdded: string;
  company: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string | null } | null;
}

interface CompanyOption { id: string; name: string }

const STATUSES = ["New", "Email Sent", "Email Sent, for Contact", "Executed Emails Sent", "No Answer", "Unattended / Not in Service", "Call Again", "Emailed", "Ongoing", "Quotation", "Approved", "Completed", "On Hold", "Cancelled", "Declined", "Infrastructure Solutions"];
const PRIORITIES = ["Low", "Medium", "High"];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [statuses, setStatuses] = useState<string[]>(STATUSES);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ companyId: "", source: "", industry: "", priority: "Medium", estimatedValue: "", notes: "" });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetch("/api/status-definitions")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          const leadStatuses = d
            .filter((s: { type: string }) => s.type === "project")
            .map((s: { name: string }) => s.name);
          if (leadStatuses.length > 0) setStatuses(leadStatuses);
        }
      })
      .catch(() => {});
  }, []);

  const fetchLeads = useCallback(async () => {
    try {
      setError("");
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      setError("Failed to load leads");
      console.error("Failed to fetch leads:", error);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchLeads();
    fetch("/api/companies?limit=999").then((r) => r.json()).then((d) => setCompanies((d.data || []).map((c: CompanyOption) => ({ id: c.id, name: c.name })))).catch(console.error);
  }, [fetchLeads]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) { alert("Failed to create lead"); return; }
    setShowForm(false);
    fetchLeads();
  };

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch(`/api/leads/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (res.ok) fetchLeads();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this lead?")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    fetchLeads();
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Leads</h1>
          <p style={{ color: "#64748b", fontSize: "0.875rem" }}>{total} leads total</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Lead"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", color: "#dc2626", padding: 12, borderRadius: 8, marginBottom: 16, border: "1px solid #fecaca" }}>
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>New Lead</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Company</label><select style={{ width: "100%" }} value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}><option value="">Select company</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Source</label><input style={{ width: "100%" }} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Referral, Website, Walk-in..." /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Industry</label><input style={{ width: "100%" }} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Priority</label><select style={{ width: "100%" }} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Estimated Value</label><input type="number" style={{ width: "100%" }} value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} placeholder="0.00" /></div>
            <div style={{ gridColumn: "span 2" }}><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Notes</label><textarea rows={2} style={{ width: "100%" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary">Create Lead</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input placeholder="Search leads..." style={{ width: 300 }} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
        <table>
          <thead>
            <tr><th>Date</th><th>Company</th><th>Source</th><th>Industry</th><th>Status</th><th>Priority</th><th>Next Follow-Up</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td style={{ whiteSpace: "nowrap" }}>{new Date(l.dateAdded).toLocaleDateString("en-PH")}</td>
                <td style={{ fontWeight: 500 }}>{l.company?.name || "Walk-in"}</td>
                <td>{l.source || "-"}</td>
                <td>{l.industry || "-"}</td>
                <td>
                  <select value={l.status} onChange={(e) => handleStatusChange(l.id, e.target.value)} style={{ padding: "2px 6px", fontSize: "0.75rem" }}>
                    {statuses.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td><span className={`badge badge-${l.priority === "High" ? "red" : l.priority === "Low" ? "gray" : "blue"}`}>{l.priority}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>{l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleDateString("en-PH") : "-"}</td>
                <td>
                  <button className="btn btn-ghost" onClick={() => handleDelete(l.id)} style={{ padding: "0.25rem 0.5rem", color: "#dc2626" }}>Delete</button>
                </td>
              </tr>
            ))}
            {leads.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>No leads found</td></tr>}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>Page {page} of {Math.ceil(total / 50)}</span>
          <button className="btn btn-secondary" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}