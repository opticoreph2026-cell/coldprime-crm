"use client";

import { useEffect, useState, useCallback } from "react";
import { LEAD_TYPES, LEAD_TYPE_STAGES } from "@/lib/enums";
import type { Lead, CompanyOption } from "@/lib/types";
import { PageHeader, ErrorBanner, EmptyRow, EmptyState, Pagination, SearchInput, Modal, ConfirmDialog } from "@/components/ui";

const PRIORITIES = ["Low", "Medium", "High"];

const TYPE_LABELS: Record<string, string> = {
  ACCREDITATION: "Accreditation",
  PROJECT_BID: "Project Bid",
  DESIGN_PARTNERSHIP: "Design Partnership",
};

const TYPE_BADGE: Record<string, string> = {
  ACCREDITATION: "badge-purple",
  PROJECT_BID: "badge-blue",
  DESIGN_PARTNERSHIP: "badge-green",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ companyId: "", type: "PROJECT_BID", source: "", industry: "", priority: "Medium", estimatedValue: "", notes: "" });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetch("/api/status-definitions?type=lead")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          const leadStatuses = d
            .filter((s: { type: string }) => s.type === "lead")
            .map((s: { name: string }) => s.name);
          if (leadStatuses.length > 0) setStatuses(leadStatuses);
        }
      })
      .catch(() => {});
  }, []);

  // Pipeline stages available for a lead's type, intersected with seeded definitions
  const stagesFor = (type: string, current?: string): string[] => {
    const stages = LEAD_TYPE_STAGES[type] || statuses;
    const available = stages.filter((s) => statuses.length === 0 || statuses.includes(s));
    if (current && !available.includes(current)) available.unshift(current);
    return available;
  };

  const fetchLeads = useCallback(async () => {
    try {
      setError("");
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      setError("Failed to load leads");
      console.error("Failed to fetch leads:", error);
    }
  }, [page, debouncedSearch, statusFilter, typeFilter]);

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/leads/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    fetchLeads();
  };

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Leads"
        subtitle={`${total} leads total`}
        actions={
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + New Lead
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

      <Modal open={showForm} title="New Lead" onClose={() => setShowForm(false)}>
        <form onSubmit={handleCreate}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Company</label><select style={{ width: "100%" }} value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}><option value="">Select company</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Lead Type</label><select style={{ width: "100%" }} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{LEAD_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}</select></div>
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
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete lead"
        message={`Delete the lead for "${deleteTarget?.name}"? This cannot be undone.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <SearchInput placeholder="Search leads..." value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setStatusFilter(""); setPage(1); }}>
          <option value="">All Types</option>
          {LEAD_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {(typeFilter ? stagesFor(typeFilter) : statuses).map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {leads.length === 0 && !search && !debouncedSearch && !statusFilter && !typeFilter && !error ? (
        <EmptyState
          message="No leads yet — add your first lead to get started."
          action={
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              + New Lead
            </button>
          }
        />
      ) : (
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
        <table>
          <thead>
            <tr><th>Date</th><th>Company</th><th>Type</th><th>Source</th><th>Industry</th><th>Status</th><th>Priority</th><th>Next Follow-Up</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td style={{ whiteSpace: "nowrap" }}>{new Date(l.dateAdded).toLocaleDateString("en-PH")}</td>
                <td style={{ fontWeight: 500 }}>{l.company?.name || "Walk-in"}</td>
                <td><span className={`badge ${TYPE_BADGE[l.type] || "badge-gray"}`}>{TYPE_LABELS[l.type] || l.type}</span></td>
                <td>{l.source || "-"}</td>
                <td>{l.industry || "-"}</td>
                <td>
                  <select value={l.status} onChange={(e) => handleStatusChange(l.id, e.target.value)} style={{ padding: "2px 6px", fontSize: "0.75rem" }}>
                    {stagesFor(l.type, l.status).map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td><span className={`badge badge-${l.priority === "High" ? "red" : l.priority === "Low" ? "gray" : "blue"}`}>{l.priority}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>{l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleDateString("en-PH") : "-"}</td>
                <td>
                  <button className="btn btn-ghost" onClick={() => setDeleteTarget({ id: l.id, name: l.company?.name || "Walk-in" })} style={{ padding: "0.25rem 0.5rem", color: "#dc2626" }}>Delete</button>
                </td>
              </tr>
            ))}
            {leads.length === 0 && <EmptyRow colSpan={9} message="No leads found" />}
          </tbody>
        </table>
      </div>
      )}

      {total > 50 && (
        <Pagination page={page} total={total} onPage={setPage} />
      )}
    </div>
  );
}