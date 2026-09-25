"use client";

import { useEffect, useState, useCallback } from "react";
import type { Project, CompanyOption } from "@/lib/types";
import { PageHeader, ErrorBanner, EmptyRow, Pagination, SearchInput, Modal, ConfirmDialog } from "@/components/ui";

const STATUSES = ["Quotation", "Approved", "Installation", "Testing", "Commissioning", "Completed", "On Hold", "Cancelled"];
const SUB_STATUSES = ["Not Started", "In Progress", "Completed", "Passed", "Failed", "Deficiencies"];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [statuses, setStatuses] = useState<string[]>(STATUSES);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ companyId: "", projectName: "", projectLocation: "", projectType: "", status: "Quotation", startDate: "", targetCompletion: "", installationStatus: "", testingStatus: "", commissioningStatus: "", remarks: "" });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetch("/api/status-definitions")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          const projectStatuses = d
            .filter((s: { type: string }) => s.type === "project")
            .map((s: { name: string }) => s.name);
          if (projectStatuses.length > 0) setStatuses(projectStatuses);
        }
      })
      .catch(() => {});
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      setError("");
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/projects?${params}`);
      const data = await res.json();
      setProjects(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      setError("Failed to load projects");
      console.error("Failed to fetch projects:", error);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchProjects();
    fetch("/api/companies?limit=999").then((r) => r.json()).then((d) => setCompanies((d.data || []).map((c: CompanyOption) => ({ id: c.id, name: c.name })))).catch(console.error);
  }, [fetchProjects]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { ...form, startDate: form.startDate || null, targetCompletion: form.targetCompletion || null };
    const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { alert("Failed to create project"); return; }
    setShowForm(false);
    fetchProjects();
  };

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch(`/api/projects/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (res.ok) fetchProjects();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/projects/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    fetchProjects();
  };

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Projects"
        subtitle={`${total} projects total`}
        actions={
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + New Project
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

      <Modal open={showForm} title="New Project" onClose={() => setShowForm(false)}>
        <form onSubmit={handleCreate}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Company *</label><select required style={{ width: "100%" }} value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}><option value="">Select company</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Project Name *</label><input required style={{ width: "100%" }} value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Location</label><input style={{ width: "100%" }} value={form.projectLocation} onChange={(e) => setForm({ ...form, projectLocation: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Type</label><input style={{ width: "100%" }} value={form.projectType} onChange={(e) => setForm({ ...form, projectType: e.target.value })} placeholder="HVAC Installation, Testing..." /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Status</label><select style={{ width: "100%" }} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Start Date</label><input type="date" style={{ width: "100%" }} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Target Completion</label><input type="date" style={{ width: "100%" }} value={form.targetCompletion} onChange={(e) => setForm({ ...form, targetCompletion: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Installation Status</label><select style={{ width: "100%" }} value={form.installationStatus} onChange={(e) => setForm({ ...form, installationStatus: e.target.value })}><option value="">--</option>{SUB_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Testing Status</label><select style={{ width: "100%" }} value={form.testingStatus} onChange={(e) => setForm({ ...form, testingStatus: e.target.value })}><option value="">--</option>{SUB_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Commissioning Status</label><select style={{ width: "100%" }} value={form.commissioningStatus} onChange={(e) => setForm({ ...form, commissioningStatus: e.target.value })}><option value="">--</option>{SUB_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div style={{ gridColumn: "span 2" }}><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Remarks</label><textarea rows={2} style={{ width: "100%" }} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary">Create Project</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete project"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <SearchInput placeholder="Search projects..." value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
        <table>
          <thead>
            <tr><th>Company</th><th>Project</th><th>Location</th><th>Status</th><th>Installation</th><th>Testing</th><th>Commissioning</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>{p.company.name}</td>
                <td>{p.projectName}</td>
                <td>{p.projectLocation || "-"}</td>
                <td>
                  <select value={p.status} onChange={(e) => handleStatusChange(p.id, e.target.value)} style={{ padding: "2px 6px", fontSize: "0.75rem" }}>
                    {statuses.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td>{p.installationStatus || "-"}</td>
                <td>{p.testingStatus || "-"}</td>
                <td>{p.commissioningStatus || "-"}</td>
                <td>
                  <button className="btn btn-ghost" onClick={() => setDeleteTarget({ id: p.id, name: p.projectName })} style={{ padding: "0.25rem 0.5rem", color: "#dc2626" }}>Delete</button>
                </td>
              </tr>
            ))}
            {projects.length === 0 && <EmptyRow colSpan={8} message="No projects found" />}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <Pagination page={page} total={total} onPage={setPage} />
      )}
    </div>
  );
}