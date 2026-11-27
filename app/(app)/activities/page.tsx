"use client";

import { useEffect, useState, useCallback } from "react";
import type { Activity, CompanyOption, ProjectOption } from "@/lib/types";
import { PageHeader, ErrorBanner, EmptyRow, EmptyState, Pagination, SearchInput, Modal, ConfirmDialog } from "@/components/ui";

  const TYPES = ["Phone Call", "Email", "SMS", "Meeting", "Site Visit", "Site Inspection", "Follow-Up", "Quotation Sent", "Quotation Follow-Up", "Accreditation Follow-Up", "Data Gathering", "Other"];

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [form, setForm] = useState({ companyId: "", projectId: "", type: "Phone Call", date: new Date().toISOString().split("T")[0], time: "", performedBy: "", contactPerson: "", description: "", result: "", nextAction: "", nextFollowUp: "", notes: "" });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchActivities = useCallback(async () => {
    try {
      setError("");
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/activities?${params}`);
      const data = await res.json();
      setActivities(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      setError("Failed to load activities");
      console.error("Failed to fetch activities:", error);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, typeFilter]);

  useEffect(() => {
    fetchActivities();
    fetch("/api/companies?limit=999").then((r) => r.json()).then((d) => setCompanies((d.data || []).map((c: CompanyOption) => ({ id: c.id, name: c.name })))).catch(console.error);
  }, [fetchActivities]);

  const handleCompanyChange = async (companyId: string) => {
    setForm({ ...form, companyId, projectId: "" });
    if (companyId) {
      try {
        const res = await fetch(`/api/projects?companyId=${companyId}&limit=999`);
        const data = await res.json();
        setProjects((data.data || []).map((p: ProjectOption) => ({ id: p.id, projectName: p.projectName })));
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      }
    } else {
      setProjects([]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { ...form, nextFollowUp: form.nextFollowUp || null };
    const res = await fetch("/api/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { setError("Failed to save - please try again"); return; }
    setShowForm(false);
    fetchActivities();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/activities/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    fetchActivities();
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = { "Phone Call": "📞", "Email": "📧", "SMS": "💬", "Meeting": "🤝", "Site Visit": "🏢", "Site Inspection": "🔍", "Follow-Up": "🔄", "Quotation Sent": "📄", "Quotation Follow-Up": "📋", "Accreditation Follow-Up": "📋", "Data Gathering": "📋", "Other": "📋" };
    return icons[type] || "📋";
  };

  return (
    <div className="page">
      <PageHeader
        title="Activities"
        subtitle={`${total} activities total`}
        actions={
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Log Activity
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

      <Modal open={showForm} title="Log Activity" onClose={() => setShowForm(false)}>
        <form onSubmit={handleCreate}>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-medium block mb-1">Type *</label><select required className="w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label className="text-xs font-medium block mb-1">Company</label><select className="w-full" value={form.companyId} onChange={(e) => handleCompanyChange(e.target.value)}><option value="">Select company</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="text-xs font-medium block mb-1">Project</label><select className="w-full" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}><option value="">Select project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}</select></div>
            <div><label className="text-xs font-medium block mb-1">Contact Person</label><input className="w-full" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
            <div><label className="text-xs font-medium block mb-1">Date *</label><input type="date" required className="w-full" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><label className="text-xs font-medium block mb-1">Time</label><input type="time" className="w-full" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
            <div className="col-span-2"><label className="text-xs font-medium block mb-1">Description</label><textarea rows={2} className="w-full" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><label className="text-xs font-medium block mb-1">Result</label><input className="w-full" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} placeholder="Completed, No Answer, Scheduled..." /></div>
            <div><label className="text-xs font-medium block mb-1">Next Action</label><input className="w-full" value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} /></div>
            <div><label className="text-xs font-medium block mb-1">Next Follow-Up</label><input type="date" className="w-full" value={form.nextFollowUp} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })} /></div>
            <div><label className="text-xs font-medium block mb-1">Performed By</label><input className="w-full" value={form.performedBy} onChange={(e) => setForm({ ...form, performedBy: e.target.value })} /></div>
            <div className="col-span-2"><label className="text-xs font-medium block mb-1">Notes</label><textarea rows={2} className="w-full" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="btn btn-primary">Log Activity</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete activity"
        message={`Delete activity "${deleteTarget?.name}"? This cannot be undone.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <div className="flex gap-3 mb-4 flex-wrap">
        <SearchInput placeholder="Search activities..." value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="page-scroll">
      {!loading && activities.length === 0 && !search && !debouncedSearch && !typeFilter && !error ? (
        <EmptyState message="No activities yet — use + Log Activity to record the first one." />
      ) : (
      <div className="bg-white border border-slate-200 overflow-hidden rounded-lg">
        <table>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Company</th><th>Contact</th><th>Description</th><th>Result</th><th>Next Follow-Up</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {activities.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap">{new Date(a.date).toLocaleDateString("en-PH")}</td>
                <td><span className="mr-1">{getTypeIcon(a.type)}</span>{a.type}</td>
                <td className="font-medium">{a.company?.name || "-"}</td>
                <td>{a.contactPerson || "-"}</td>
                <td className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[250px]">{a.description || "-"}</td>
                <td>{a.result || "-"}</td>
                <td className="whitespace-nowrap">{a.nextFollowUp ? new Date(a.nextFollowUp).toLocaleDateString("en-PH") : "-"}</td>
                <td>
                  <button className="btn btn-ghost px-2 py-1 text-red-600" onClick={() => setDeleteTarget({ id: a.id, name: a.description || a.type })}>Delete</button>
                </td>
              </tr>
            ))}
            {activities.length === 0 && <EmptyRow colSpan={8} message={loading ? "Loading…" : "No activities found"} />}
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