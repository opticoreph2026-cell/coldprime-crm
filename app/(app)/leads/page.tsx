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
  const [loading, setLoading] = useState(true);
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
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, typeFilter]);

  useEffect(() => {
    fetchLeads();
    fetch("/api/companies?limit=999").then((r) => r.json()).then((d) => setCompanies((d.data || []).map((c: CompanyOption) => ({ id: c.id, name: c.name })))).catch(console.error);
  }, [fetchLeads]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) { setError("Failed to save - please try again"); return; }
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
    <div className="page">
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
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-medium block mb-1">Company</label><select className="w-full" value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}><option value="">Select company</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="text-xs font-medium block mb-1">Lead Type</label><select className="w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{LEAD_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}</select></div>
            <div><label className="text-xs font-medium block mb-1">Source</label><input className="w-full" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Referral, Website, Walk-in..." /></div>
            <div><label className="text-xs font-medium block mb-1">Industry</label><input className="w-full" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></div>
            <div><label className="text-xs font-medium block mb-1">Priority</label><select className="w-full" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></div>
            <div><label className="text-xs font-medium block mb-1">Estimated Value</label><input type="number" className="w-full" value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} placeholder="0.00" /></div>
            <div className="col-span-2"><label className="text-xs font-medium block mb-1">Notes</label><textarea rows={2} className="w-full" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex gap-2">
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

      <div className="flex gap-3 mb-4 flex-wrap">
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

      <div className="page-scroll">
      {!loading && leads.length === 0 && !search && !debouncedSearch && !statusFilter && !typeFilter && !error ? (
        <EmptyState message="No leads yet — use + New Lead to create the first one." />
      ) : (
      <div className="bg-white border border-slate-200 overflow-hidden rounded-lg">
        <table>
          <thead>
            <tr><th>Date</th><th>Company</th><th>Type</th><th>Source</th><th>Industry</th><th>Status</th><th>Priority</th><th>Next Follow-Up</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap">{new Date(l.dateAdded).toLocaleDateString("en-PH")}</td>
                <td className="font-medium">{l.company?.name || "Walk-in"}</td>
                <td><span className={`badge ${TYPE_BADGE[l.type] || "badge-gray"}`}>{TYPE_LABELS[l.type] || l.type}</span></td>
                <td>{l.source || "-"}</td>
                <td>{l.industry || "-"}</td>
                <td>
                  <select value={l.status} onChange={(e) => handleStatusChange(l.id, e.target.value)} className="px-1.5 py-0.5 text-xs">
                    {stagesFor(l.type, l.status).map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td><span className={`badge badge-${l.priority === "High" ? "red" : l.priority === "Low" ? "gray" : "blue"}`}>{l.priority}</span></td>
                <td className="whitespace-nowrap">{l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleDateString("en-PH") : "-"}</td>
                <td>
                  <button className="btn btn-ghost px-2 py-1 text-red-600" onClick={() => setDeleteTarget({ id: l.id, name: l.company?.name || "Walk-in" })}>Delete</button>
                </td>
              </tr>
            ))}
            {leads.length === 0 && <EmptyRow colSpan={9} message={loading ? "Loading…" : "No leads found"} />}
          </tbody>
        </table>
      </div>
      )}
      </div>

      {total > 50 && (
        <Pagination page={page} total={total} onPage={setPage} />
      )}
    </div>
  );
}