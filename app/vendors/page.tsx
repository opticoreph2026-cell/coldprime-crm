"use client";

import { useEffect, useState, useCallback } from "react";
import type { Vendor } from "@/lib/types";
import { PageHeader, ErrorBanner, EmptyState, Pagination, Modal, ConfirmDialog } from "@/components/ui";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({ name: "", category: "", status: "Active" });
  const [error, setError] = useState("");
  const [view, setView] = useState<"vendors" | "priceList">("vendors");

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/vendors/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      if (res.ok) fetchVendors();
    } catch {
      setError("Failed to delete");
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Vendors"
        subtitle="Equipment and materials suppliers — HVAC, IAQ, and related"
        actions={
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: "", category: "", status: "Active" }); }}>
            + Add Vendor
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["vendors", "priceList"] as const).map((v) => (
          <button
            key={v}
            className={view === v ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setView(v)}
          >
            {v === "vendors" ? "Vendors" : "Price List"}
          </button>
        ))}
      </div>

      <Modal open={showForm} title={editingId ? "Edit Vendor" : "New Vendor"} onClose={() => { setShowForm(false); setEditingId(null); }}>
        <form onSubmit={handleSubmit}>
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
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete vendor"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

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

      {view === "priceList" ? (
        (() => {
          const rows = vendors.flatMap((v) =>
            (v.materials || []).map((m) => ({ vendor: v, m }))
          ).sort((a, b) => a.vendor.name.localeCompare(b.vendor.name) || a.m.itemName.localeCompare(b.m.itemName));
          return (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflowX: "auto" }}>
              {rows.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
                  No materials found on this page of vendors. Open a vendor and add items to its Price List.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Vendor", "Item", "Category", "Brand", "Model", "Unit", "Unit Price", "Valid Until"].map((h) => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ vendor, m }) => (
                      <tr key={m.id}>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                          <a href={`/vendors/${vendor.id}`} style={{ color: "#1e40af", fontWeight: 600, textDecoration: "none" }}>{vendor.name}</a>
                        </td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9", fontWeight: 600 }}>{m.itemName}</td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{m.category || "-"}</td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{m.brand || "-"}</td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{m.model || "-"}</td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{m.unit || "-"}</td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{m.unitPrice} {m.currency}</td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{m.priceValidUntil ? new Date(m.priceValidUntil).toLocaleDateString() : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })()
      ) : vendors.length === 0 && !search && !debouncedSearch && !category && !error ? (
        <EmptyState
          message="No vendors yet — add your first vendor to get started."
          action={
            <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: "", category: "", status: "Active" }); }}>
              + Add Vendor
            </button>
          }
        />
      ) : (
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
                <button className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: "0.75rem", color: "#dc2626" }} onClick={() => setDeleteTarget({ id: v.id, name: v.name })}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
      )}

      {total > 50 && (
        <Pagination page={page} total={total} onPage={setPage} />
      )}
    </div>
  );
}
