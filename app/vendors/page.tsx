"use client";

import { useEffect, useState, useCallback } from "react";
import type { Vendor } from "@/lib/types";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", category: "", status: "Active" });
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchVendors = useCallback(async () => {
    try {
      setError("");
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (category) params.set("category", category);
      const res = await fetch(`/api/vendors?${params}`);
      const data = await res.json();
      setVendors(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch {
      setError("Failed to load vendors");
    }
  }, [page, debouncedSearch, category]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const url = editingId ? `/api/vendors/${editingId}` : "/api/vendors";
    const method = editingId ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setForm({ name: "", category: "", status: "Active" });
        fetchVendors();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Network error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this vendor?")) return;
    try {
      const res = await fetch(`/api/vendors/${id}`, { method: "DELETE" });
      if (res.ok) fetchVendors();
    } catch {
      setError("Failed to delete");
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Vendors</h1>
          <p style={{ color: "#64748b", fontSize: "0.875rem" }}>Equipment and materials suppliers — HVAC, IAQ, and related</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: "", category: "", status: "Active" }); }}>
          {showForm ? "Cancel" : "+ Add Vendor"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", color: "#dc2626", padding: 12, borderRadius: 8, marginBottom: 16, border: "1px solid #fecaca" }}>
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>{editingId ? "Edit Vendor" : "New Vendor"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Name *</label>
              <input required style={{ width: "100%", padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: 4 }}
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Category</label>
              <input style={{ width: "100%", padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: 4 }}
                value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Status</label>
              <select style={{ width: "100%", padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: 4 }}
                value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }}>
            {editingId ? "Update" : "Create"}
          </button>
        </form>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input placeholder="Search vendors..." style={{ flex: 1, padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: 4 }}
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: 4 }}
          value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          <option value="Equipment Supplier">Equipment Supplier</option>
          <option value="Materials Supplier">Materials Supplier</option>
          <option value="Refrigerant Supplier">Refrigerant Supplier</option>
          <option value="IAQ Sensor">IAQ Sensor</option>
        </select>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
        {vendors.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No vendors found</div>
        ) : (
          vendors.map((v) => (
            <div key={v.id} style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{v.name}</div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  {v.category} • {v.contacts.length} contacts • {v.materials.length} materials
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <a href={`/vendors/${v.id}`} className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: "0.75rem", textDecoration: "none" }}>View</a>
                <button className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: "0.75rem" }} onClick={() => { setEditingId(v.id); setForm({ name: v.name, category: v.category || "", status: v.status }); setShowForm(true); }}>Edit</button>
                <button className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: "0.75rem", color: "#dc2626" }} onClick={() => handleDelete(v.id)}>Delete</button>
              </div>
            </div>
          ))
        )}
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
