"use client";

import { useEffect, useState, useCallback } from "react";

interface Activity {
  id: string;
  type: string;
  date: string;
  time: string | null;
  performedBy: string | null;
  contactPerson: string | null;
  description: string | null;
  result: string | null;
  nextAction: string | null;
  nextFollowUp: string | null;
  company: { id: string; name: string } | null;
  project: { id: string; projectName: string } | null;
}

interface CompanyOption { id: string; name: string }
interface ProjectOption { id: string; projectName: string }

const TYPES = ["Phone Call", "Email", "SMS", "Meeting", "Site Visit", "Follow-Up", "Quotation Sent", "Quotation Follow-Up", "Accreditation Follow-Up", "Data Gathering", "Other"];

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [form, setForm] = useState({ companyId: "", projectId: "", type: "Phone Call", date: new Date().toISOString().split("T")[0], time: "", performedBy: "", contactPerson: "", description: "", result: "", nextAction: "", nextFollowUp: "", notes: "" });

  const fetchActivities = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (search) params.set("search", search);
    if (typeFilter) params.set("type", typeFilter);
    const res = await fetch(`/api/activities?${params}`);
    const data = await res.json();
    setActivities(data.data || []);
    setTotal(data.pagination?.total || 0);
  }, [page, search, typeFilter]);

  useEffect(() => {
    fetchActivities();
    fetch("/api/companies?limit=999").then((r) => r.json()).then((d) => setCompanies((d.data || []).map((c: CompanyOption) => ({ id: c.id, name: c.name }))));
  }, [fetchActivities]);

  const handleCompanyChange = async (companyId: string) => {
    setForm({ ...form, companyId, projectId: "" });
    if (companyId) {
      const res = await fetch(`/api/projects?companyId=${companyId}&limit=999`);
      const data = await res.json();
      setProjects((data.data || []).map((p: ProjectOption) => ({ id: p.id, projectName: p.projectName })));
    } else {
      setProjects([]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowForm(false);
    fetchActivities();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this activity?")) return;
    await fetch(`/api/activities/${id}`, { method: "DELETE" });
    fetchActivities();
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = { "Phone Call": "📞", "Email": "📧", "SMS": "💬", "Meeting": "🤝", "Site Visit": "🏢", "Follow-Up": "🔄", "Quotation Sent": "📄", "Other": "📋" };
    return icons[type] || "📋";
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Activities</h1>
          <p style={{ color: "#64748b", fontSize: "0.875rem" }}>{total} activities total</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Log Activity"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Log Activity</h2>
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
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary">Log Activity</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input placeholder="Search activities..." style={{ width: 300 }} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

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
                  <button className="btn btn-ghost" onClick={() => handleDelete(a.id)} style={{ padding: "0.25rem 0.5rem", color: "#dc2626" }}>Delete</button>
                </td>
              </tr>
            ))}
            {activities.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>No activities found</td></tr>}
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