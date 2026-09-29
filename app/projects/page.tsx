"use client";

import { useEffect, useState, useCallback } from "react";
import type { Project, CompanyOption } from "@/lib/types";
import { PageHeader, ErrorBanner, EmptyRow, EmptyState, Pagination, SearchInput, Modal, ConfirmDialog } from "@/components/ui";

const STATUSES = ["Quotation", "Approved", "Installation", "Testing", "Commissioning", "Completed", "On Hold", "Cancelled"];
const SUB_STATUSES = ["Not Started", "In Progress", "Completed", "Passed", "Failed", "Deficiencies"];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
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
    } finally {
      setLoading(false);
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
    if (!res.ok) { setError("Failed to save - please try again"); return; }
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
    <div className="page">
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
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-medium block mb-1">Company *</label><select required className="w-full" value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}><option value="">Select company</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="text-xs font-medium block mb-1">Project Name *</label><input required className="w-full" value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} /></div>
            <div><label className="text-xs font-medium block mb-1">Location</label><input className="w-full" value={form.projectLocation} onChange={(e) => setForm({ ...form, projectLocation: e.target.value })} /></div>
            <div><label className="text-xs font-medium block mb-1">Type</label><input className="w-full" value={form.projectType} onChange={(e) => setForm({ ...form, projectType: e.target.value })} placeholder="HVAC Installation, Testing..." /></div>
            <div><label className="text-xs font-medium block mb-1">Status</label><select className="w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className="text-xs font-medium block mb-1">Start Date</label><input type="date" className="w-full" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label className="text-xs font-medium block mb-1">Target Completion</label><input type="date" className="w-full" value={form.targetCompletion} onChange={(e) => setForm({ ...form, targetCompletion: e.target.value })} /></div>
            <div><label className="text-xs font-medium block mb-1">Installation Status</label><select className="w-full" value={form.installationStatus} onChange={(e) => setForm({ ...form, installationStatus: e.target.value })}><option value="">--</option>{SUB_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className="text-xs font-medium block mb-1">Testing Status</label><select className="w-full" value={form.testingStatus} onChange={(e) => setForm({ ...form, testingStatus: e.target.value })}><option value="">--</option>{SUB_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className="text-xs font-medium block mb-1">Commissioning Status</label><select className="w-full" value={form.commissioningStatus} onChange={(e) => setForm({ ...form, commissioningStatus: e.target.value })}><option value="">--</option>{SUB_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="col-span-2"><label className="text-xs font-medium block mb-1">Remarks</label><textarea rows={2} className="w-full" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex gap-2">
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

      <div className="flex gap-3 mb-4 flex-wrap">
        <SearchInput placeholder="Search projects..." value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="page-scroll">
      {!loading && projects.length === 0 && !search && !debouncedSearch && !statusFilter && !error ? (
        <EmptyState message="No projects yet — use + New Project to create the first one." />
      ) : (
      <div className="bg-white border border-slate-200 overflow-hidden rounded-lg">
        <table>
          <thead>
            <tr><th>Company</th><th>Project</th><th>Location</th><th>Status</th><th>Installation</th><th>Testing</th><th>Commissioning</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.company.name}</td>
                <td>{p.projectName}</td>
                <td>{p.projectLocation || "-"}</td>
                <td>
                  <select value={p.status} onChange={(e) => handleStatusChange(p.id, e.target.value)} className="px-1.5 py-0.5 text-xs">
                    {statuses.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td>{p.installationStatus || "-"}</td>
                <td>{p.testingStatus || "-"}</td>
                <td>{p.commissioningStatus || "-"}</td>
                <td>
                  <button className="btn btn-ghost px-2 py-1 text-red-600" onClick={() => setDeleteTarget({ id: p.id, name: p.projectName })}>Delete</button>
                </td>
              </tr>
            ))}
            {projects.length === 0 && <EmptyRow colSpan={8} message={loading ? "Loading…" : "No projects found"} />}
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