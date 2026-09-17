"use client";

import { useEffect, useState, useCallback } from "react";

interface Company {
  id: string;
  name: string;
  industry: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  status: string;
  createdAt: string;
  _count: { contacts: number; projects: number; activities: number; leads: number };
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", industry: "Other", email: "", phone: "", address: "", website: "", status: "Active", notes: "", source: "" });

  const fetchCompanies = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/companies?${params}`);
    const data = await res.json();
    setCompanies(data.data || []);
    setTotal(data.pagination?.total || 0);
  }, [page, search, statusFilter]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/companies/${editingId}` : "/api/companies";
    const method = editingId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) {
      setShowForm(false);
      setEditingId(null);
      setForm({ name: "", industry: "Other", email: "", phone: "", address: "", website: "", status: "Active", notes: "", source: "" });
      fetchCompanies();
    }
  };

  const handleEdit = (c: Company) => {
    setForm({ name: c.name, industry: c.industry, email: c.email || "", phone: c.phone || "", address: c.address || "", website: c.website || "", status: c.status, notes: "", source: "" });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this company?")) return;
    await fetch(`/api/companies/${id}`, { method: "DELETE" });
    fetchCompanies();
  };

  const industries = ["General Contractor", "Architectural", "Construction", "Business Process Outsourcing (BPO)", "Security Systems", "Hotel", "Hospital", "Restaurant", "Retail", "Government", "Manufacturing", "Real Estate", "Education", "IT / Technology", "Healthcare", "Other"];
  const statuses = ["Active", "Inactive", "Pending", "Prospect", "Archived"];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Companies</h1>
          <p style={{ color: "#64748b", fontSize: "0.875rem" }}>{total} companies total</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: "", industry: "Other", email: "", phone: "", address: "", website: "", status: "Active", notes: "", source: "" }); }}>
          {showForm ? "Cancel" : "+ Add Company"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>{editingId ? "Edit Company" : "New Company"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Company Name *</label><input required style={{ width: "100%" }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Industry</label><select style={{ width: "100%" }} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>{industries.map((i) => <option key={i}>{i}</option>)}</select></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Email</label><input type="email" style={{ width: "100%" }} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Phone</label><input style={{ width: "100%" }} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0917-123-4567" /></div>
            <div style={{ gridColumn: "span 2" }}><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Address</label><input style={{ width: "100%" }} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Website</label><input style={{ width: "100%" }} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Status</label><select style={{ width: "100%" }} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div style={{ gridColumn: "span 2" }}><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Notes</label><textarea rows={2} style={{ width: "100%" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary">{editingId ? "Update" : "Create"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
        </form>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input placeholder="Search companies..." style={{ width: 300 }} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Industry</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Contacts</th>
              <th>Projects</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}>{c.name}</td>
                <td>{c.industry}</td>
                <td>{c.email || "-"}</td>
                <td style={{ whiteSpace: "nowrap" }}>{c.phone || "-"}</td>
                <td><span className={`badge badge-${c.status === "Active" ? "green" : c.status === "Inactive" ? "gray" : "blue"}`}>{c.status}</span></td>
                <td>{c._count.contacts}</td>
                <td>{c._count.projects}</td>
                <td>
                  <button className="btn btn-ghost" onClick={() => handleEdit(c)} style={{ padding: "0.25rem 0.5rem" }}>Edit</button>
                  <button className="btn btn-ghost" onClick={() => handleDelete(c.id)} style={{ padding: "0.25rem 0.5rem", color: "#dc2626" }}>Delete</button>
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>No companies found</td></tr>
            )}
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