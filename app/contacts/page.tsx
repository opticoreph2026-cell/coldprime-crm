"use client";

import { useEffect, useState, useCallback } from "react";

interface Contact {
  id: string;
  firstName: string;
  lastName: string | null;
  position: string | null;
  email: string | null;
  mobile: string | null;
  landline: string | null;
  notes: string | null;
  status: string;
  company: { id: string; name: string };
}

interface CompanyOption { id: string; name: string }

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ companyId: "", firstName: "", lastName: "", position: "", email: "", mobile: "", landline: "", notes: "" });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchContacts = useCallback(async () => {
    try {
      setError("");
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/contacts?${params}`);
      const data = await res.json();
      setContacts(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      setError("Failed to load contacts");
      console.error("Failed to fetch contacts:", error);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchContacts();
    fetch("/api/companies?limit=999").then((r) => r.json()).then((d) => setCompanies((d.data || []).map((c: CompanyOption) => ({ id: c.id, name: c.name })))).catch(console.error);
  }, [fetchContacts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/contacts/${editingId}` : "/api/contacts";
    const method = editingId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) { alert("Failed to save contact"); return; }
    setShowForm(false);
    setEditingId(null);
    fetchContacts();
  };

  const handleEdit = (c: Contact) => {
    setForm({ companyId: c.company.id, firstName: c.firstName, lastName: c.lastName || "", position: c.position || "", email: c.email || "", mobile: c.mobile || "", landline: c.landline || "", notes: c.notes || "" });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    fetchContacts();
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Contacts</h1>
          <p style={{ color: "#64748b", fontSize: "0.875rem" }}>{total} contacts total</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ companyId: "", firstName: "", lastName: "", position: "", email: "", mobile: "", landline: "", notes: "" }); }}>
          {showForm ? "Cancel" : "+ Add Contact"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", color: "#dc2626", padding: 12, borderRadius: 8, marginBottom: 16, border: "1px solid #fecaca" }}>
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>{editingId ? "Edit Contact" : "New Contact"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Company *</label><select required style={{ width: "100%" }} value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}><option value="">Select company</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>First Name *</label><input required style={{ width: "100%" }} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Last Name</label><input style={{ width: "100%" }} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Position</label><input style={{ width: "100%" }} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Email</label><input type="email" style={{ width: "100%" }} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Mobile</label><input style={{ width: "100%" }} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="0917-123-4567" /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Landline</label><input style={{ width: "100%" }} value={form.landline} onChange={(e) => setForm({ ...form, landline: e.target.value })} placeholder="(032) 123-4567" /></div>
            <div style={{ gridColumn: "span 2" }}><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Notes</label><textarea rows={2} style={{ width: "100%" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary">{editingId ? "Update" : "Create"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
        </form>
      )}

      <div style={{ marginBottom: 16 }}>
        <input placeholder="Search contacts..." style={{ width: 400 }} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
        <table>
          <thead>
            <tr><th>Name</th><th>Company</th><th>Position</th><th>Email</th><th>Mobile</th><th>Landline</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}>{c.firstName} {c.lastName || ""}</td>
                <td>{c.company.name}</td>
                <td>{c.position || "-"}</td>
                <td>{c.email || "-"}</td>
                <td style={{ whiteSpace: "nowrap" }}>{c.mobile || "-"}</td>
                <td style={{ whiteSpace: "nowrap" }}>{c.landline || "-"}</td>
                <td>
                  <button className="btn btn-ghost" onClick={() => handleEdit(c)} style={{ padding: "0.25rem 0.5rem" }}>Edit</button>
                  <button className="btn btn-ghost" onClick={() => handleDelete(c.id)} style={{ padding: "0.25rem 0.5rem", color: "#dc2626" }}>Delete</button>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>No contacts found</td></tr>}
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