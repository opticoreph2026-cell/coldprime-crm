"use client";

import { useEffect, useState, useCallback } from "react";
import type { Vendor } from "@/lib/types";
import { PageHeader, ErrorBanner, EmptyState, Pagination, Modal, ConfirmDialog } from "@/components/ui";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
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
    } finally {
      setLoading(false);
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
    <div className="page">
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

      <div className="flex gap-2 mb-4">
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium block mb-1">Name *</label>
              <input required className="w-full p-2 border border-slate-200 rounded"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Category</label>
              <input className="w-full p-2 border border-slate-200 rounded"
                value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Status</label>
              <select className="w-full p-2 border border-slate-200 rounded"
                value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary mt-4">
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

      <div className="flex gap-2 mb-4">
        <input placeholder="Search vendors..." className="flex-1 p-2 border border-slate-200 rounded"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="p-2 border border-slate-200 rounded"
          value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          <option value="Equipment Supplier">Equipment Supplier</option>
          <option value="Materials Supplier">Materials Supplier</option>
          <option value="Refrigerant Supplier">Refrigerant Supplier</option>
          <option value="IAQ Sensor">IAQ Sensor</option>
        </select>
      </div>

      <div className="page-scroll">
      {view === "priceList" ? (
        (() => {
          const rows = vendors.flatMap((v) =>
            (v.materials || []).map((m) => ({ vendor: v, m }))
          ).sort((a, b) => a.vendor.name.localeCompare(b.vendor.name) || a.m.itemName.localeCompare(b.m.itemName));
          return (
            <div className="bg-white border border-slate-200 overflow-x-auto rounded-lg">
              {rows.length === 0 ? (
                <div className="text-center text-slate-400 p-10">
                  No materials found on this page of vendors. Open a vendor and add items to its Price List.
                </div>
              ) : (
                <table className="w-full border-collapse text-[13.6px]">
                  <thead>
                    <tr className="bg-slate-50">
                      {["Vendor", "Item", "Category", "Brand", "Model", "Unit", "Unit Price", "Valid Until"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left border-b border-b-slate-200">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ vendor, m }) => (
                      <tr key={m.id}>
                        <td className="px-3 py-2 border-b border-b-slate-100 whitespace-nowrap">
                          <a href={`/vendors/${vendor.id}`} className="text-blue-800 font-semibold no-underline">{vendor.name}</a>
                        </td>
                        <td className="px-3 py-2 border-b border-b-slate-100 font-semibold">{m.itemName}</td>
                        <td className="px-3 py-2 border-b border-b-slate-100">{m.category || "-"}</td>
                        <td className="px-3 py-2 border-b border-b-slate-100">{m.brand || "-"}</td>
                        <td className="px-3 py-2 border-b border-b-slate-100">{m.model || "-"}</td>
                        <td className="px-3 py-2 border-b border-b-slate-100">{m.unit || "-"}</td>
                        <td className="px-3 py-2 border-b border-b-slate-100 whitespace-nowrap">{m.unitPrice !== undefined ? `${m.unitPrice} ${m.currency}` : "—"}</td>
                        <td className="px-3 py-2 border-b border-b-slate-100">{m.priceValidUntil ? new Date(m.priceValidUntil).toLocaleDateString() : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })()
      ) : !loading && vendors.length === 0 && !search && !debouncedSearch && !category && !error ? (
        <EmptyState message="No vendors yet — use + Add Vendor to create the first one." />
      ) : (
      <div className="bg-white border border-slate-200 rounded-lg">
        {vendors.length === 0 ? (
          <div className="text-center text-slate-400 p-10">{loading ? "Loading…" : "No vendors found"}</div>
        ) : (
          vendors.map((v) => (
            <div key={v.id} className="px-4 py-3 border-b border-b-slate-100 flex justify-between items-center">
              <div>
                <div className="font-semibold">{v.name}</div>
                <div className="text-xs text-slate-500">
                  {v.category} • {v.contacts.length} contacts • {v.materials.length} materials
                </div>
              </div>
              <div className="flex gap-2">
                <a href={`/vendors/${v.id}`} className="btn btn-secondary px-3 py-1 text-xs no-underline">View</a>
                <button className="btn btn-secondary px-3 py-1 text-xs" onClick={() => { setEditingId(v.id); setForm({ name: v.name, category: v.category || "", status: v.status }); setShowForm(true); }}>Edit</button>
                <button className="btn btn-secondary px-3 py-1 text-xs text-red-600" onClick={() => setDeleteTarget({ id: v.id, name: v.name })}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
      )}
      </div>

      {total > 50 && (
        <Pagination page={page} total={total} onPage={setPage} />
      )}
    </div>
  );
}
