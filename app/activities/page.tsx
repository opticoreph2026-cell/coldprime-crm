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
    <div style={{ padding: 24 }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Type *</label><select required style={{ width: "100%" }} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Company</label><select style={{ width: "100%" }} value={form.companyId} onChange={(e) => handleCompanyChange(e.target.value)}><option value="">Select company</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Project</label><select style={{ width: "100%" }} value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}><option value="">Select project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}</select></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Contact Person</label><input style={{ width: "100%" }} value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Date *</label><input type="date" required style={{ width: "100%" }} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Time</label><input type="time" style={{ width: "100%" }} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
            <div style={{ gridColumn: "span 2" }}><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Description</label><textarea rows={2} style={{ width: "100%" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Result</label><input style={{ width: "100%" }} value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} placeholder="Completed, No Answer, Scheduled..." /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Next Action</label><input style={{ width: "100%" }} value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Next Follow-Up</label><input type="date" style={{ width: "100%" }} value={form.nextFollowUp} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Performed By</label><input style={{ width: "100%" }} value={form.performedBy} onChange={(e) => setForm({ ...form, performedBy: e.target.value })} /></div>
            <div style={{ gridColumn: "span 2" }}><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Notes</label><textarea rows={2} style={{ width: "100%" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
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

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <SearchInput placeholder="Search activities..." value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      {!loading && activities.length === 0 && !search && !debouncedSearch && !typeFilter && !error ? (
        <EmptyState
          message="No activities yet — log your first activity to get started."
          action={
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              + Log Activity
            </button>
          }
        />
      ) : (
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
        <table>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Company</th><th>Contact</th><th>Description</th><th>Result</th><th>Next Follow-Up</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {activities.map((a) => (
              <tr key={a.id}>
                <td style={{ whiteSpace: "nowrap" }}>{new Date(a.date).toLocaleDateString("en-PH")}</td>
                <td><span style={{ marginRight: 4 }}>{getTypeIcon(a.type)}</span>{a.type}</td>
                <td style={{ fontWeight: 500 }}>{a.company?.name || "-"}</td>
                <td>{a.contactPerson || "-"}</td>
                <td style={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.description || "-"}</td>
                <td>{a.result || "-"}</td>
                <td style={{ whiteSpace: "nowrap" }}>{a.nextFollowUp ? new Date(a.nextFollowUp).toLocaleDateString("en-PH") : "-"}</td>
                <td>
                  <button className="btn btn-ghost" onClick={() => setDeleteTarget({ id: a.id, name: a.description || a.type })} style={{ padding: "0.25rem 0.5rem", color: "#dc2626" }}>Delete</button>
                </td>
              </tr>
            ))}
            {activities.length === 0 && <EmptyRow colSpan={8} message={loading ? "Loading…" : "No activities found"} />}
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