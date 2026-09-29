"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { Product } from "@/lib/types";
import { priceValidity } from "@/lib/dates";
import { PageHeader, ErrorBanner, EmptyState, Pagination, Modal, ConfirmDialog, Badge } from "@/components/ui";

const emptyForm = {
  name: "",
  category: "",
  brand: "",
  model: "",
  unit: "",
  sellPrice: "",
  currency: "PHP",
  priceValidUntil: "",
  leadTimeDays: "",
  isActive: true,
  notes: "",
};

interface PreviewState {
  fileName: string;
  rows: Record<string, unknown>[];
  duplicateRows: number[];
  errors: { row: number; reason: string }[];
  total: number;
}

function ValidityBadge({ value }: { value?: string | null }) {
  const state = priceValidity(value);
  if (state === "none") return <span className="text-slate-400">—</span>;
  if (state === "expired") return <Badge color="red">Expired</Badge>;
  if (state === "expiring") return <Badge color="yellow">Expiring</Badge>;
  return <span className="whitespace-nowrap">{String(value).slice(0, 10)}</span>;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchProducts = useCallback(async () => {
    try {
      setError("");
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (category) params.set("category", category);
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      setProducts(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch {
      setError("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, category]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openForm = (p?: Product) => {
    setForm(p
      ? {
          name: p.name,
          category: p.category || "",
          brand: p.brand || "",
          model: p.model || "",
          unit: p.unit || "",
          sellPrice: p.sellPrice !== null && p.sellPrice !== undefined ? String(p.sellPrice) : "",
          currency: p.currency || "PHP",
          priceValidUntil: p.priceValidUntil ? String(p.priceValidUntil).slice(0, 10) : "",
          leadTimeDays: p.leadTimeDays !== null && p.leadTimeDays !== undefined ? String(p.leadTimeDays) : "",
          isActive: p.isActive ?? true,
          notes: p.notes || "",
        }
      : emptyForm);
    setEditingId(p?.id || null);
    setError("");
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(editingId ? `/api/products/${editingId}` : "/api/products", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setFormOpen(false);
        setEditingId(null);
        setForm(emptyForm);
        fetchProducts();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/products/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      if (res.ok) fetchProducts();
      else {
        const data = await res.json();
        setError(data.error || "Failed to delete");
      }
    } catch {
      setError("Failed to delete");
    }
  };

  const runImport = async (action: "preview" | "import") => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a CSV or Excel file first");
      return;
    }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("action", action);
      const res = await fetch("/api/products/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Import failed (${res.status})`);
      if (action === "preview") {
        setPreview({ fileName: file.name, rows: data.rows || [], duplicateRows: data.duplicateRows || [], errors: data.errors || [], total: data.total || 0 });
      } else {
        toast.success(`Imported ${data.imported} products (${data.skipped} skipped as duplicates)`);
        setPreview(null);
        setImportOpen(false);
        if (fileRef.current) fileRef.current.value = "";
        fetchProducts();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const inputStyle = { width: "100%", padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: 4 };
  const labelStyle = { fontSize: "0.75rem", fontWeight: 500 as const, display: "block" as const, marginBottom: 4 };

  return (
    <div className="page">
      <PageHeader
        title="Products"
        subtitle="Sell price book — what Coldprime charges clients"
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => { setPreview(null); setImportOpen(true); }}>
              Import CSV / Excel
            </button>
            <button className="btn btn-primary" onClick={() => openForm()}>
              + Add Product
            </button>
          </>
        }
      />

      {error && <ErrorBanner message={error} />}

      <div className="flex gap-2 mb-4">
        <input placeholder="Search products..." className="flex-1 p-2 border border-slate-200 rounded"
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="p-2 border border-slate-200 rounded"
          value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          <option value="HVAC Equipment">HVAC Equipment</option>
          <option value="IAQ Equipment">IAQ Equipment</option>
          <option value="Sensors">Sensors</option>
          <option value="Spare Parts">Spare Parts</option>
          <option value="Services">Services</option>
          <option value="Consumables">Consumables</option>
        </select>
      </div>

      <div className="page-scroll">
      {!loading && products.length === 0 && !search && !category && !error ? (
        <EmptyState message="No products yet — use + Add Product to create the first one, or import a price list." />
      ) : (
        <div className="bg-white border border-slate-200 overflow-x-auto rounded-lg">
          {products.length === 0 ? (
            <div className="text-center text-slate-400 p-10">{loading ? "Loading…" : "No products found"}</div>
          ) : (
            <table className="w-full border-collapse text-[13.6px]">
              <thead>
                <tr className="bg-slate-50">
                  {["Product", "Category", "Brand / Model", "Unit", "Sell Price", "Lead Time", "Valid Until", "Status", ""].map((h) => (
                    <th key={h} className="px-3 py-2 text-left border-b border-b-slate-200 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 border-b border-b-slate-100 font-semibold">{p.name}</td>
                    <td className="px-3 py-2 border-b border-b-slate-100">{p.category || "-"}</td>
                    <td className="px-3 py-2 border-b border-b-slate-100 whitespace-nowrap">{[p.brand, p.model].filter(Boolean).join(" / ") || "-"}</td>
                    <td className="px-3 py-2 border-b border-b-slate-100">{p.unit || "-"}</td>
                    <td className="px-3 py-2 border-b border-b-slate-100 whitespace-nowrap">
                      {p.sellPrice !== null && p.sellPrice !== undefined ? `${p.sellPrice} ${p.currency}` : "-"}
                    </td>
                    <td className="px-3 py-2 border-b border-b-slate-100 whitespace-nowrap">
                      {p.leadTimeDays !== null && p.leadTimeDays !== undefined ? `${p.leadTimeDays} days` : "-"}
                    </td>
                    <td className="px-3 py-2 border-b border-b-slate-100"><ValidityBadge value={p.priceValidUntil} /></td>
                    <td className="px-3 py-2 border-b border-b-slate-100">
                      <Badge color={p.isActive ? "green" : "gray"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td className="px-3 py-2 border-b border-b-slate-100 whitespace-nowrap">
                      <button className="btn btn-ghost px-[6.4px] py-[2.4px]" onClick={() => openForm(p)}>Edit</button>
                      <button className="btn btn-ghost px-[6.4px] py-[2.4px] text-red-600" onClick={() => setDeleteTarget({ id: p.id, name: p.name })}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      </div>

      {total > 50 && <Pagination page={page} total={total} onPage={setPage} />}

      <Modal open={formOpen} title={editingId ? "Edit Product" : "New Product"} onClose={() => { setFormOpen(false); setEditingId(null); }} width={640}>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label style={labelStyle}>Name *</label>
              <input required style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div><label style={labelStyle}>Category</label><input style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div><label style={labelStyle}>Unit</label><input style={inputStyle} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs, set, hr..." /></div>
            <div><label style={labelStyle}>Brand</label><input style={inputStyle} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
            <div><label style={labelStyle}>Model</label><input style={inputStyle} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
            <div><label style={labelStyle}>Sell Price</label><input type="number" step="0.01" min="0" style={inputStyle} value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} /></div>
            <div>
              <label style={labelStyle}>Currency</label>
              <select style={inputStyle} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option value="PHP">PHP</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div><label style={labelStyle}>Price Valid Until</label><input type="date" style={inputStyle} value={form.priceValidUntil} onChange={(e) => setForm({ ...form, priceValidUntil: e.target.value })} /></div>
            <div><label style={labelStyle}>Lead Time (days)</label><input type="number" min="0" style={inputStyle} value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })} /></div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={form.isActive ? "active" : "inactive"} onChange={(e) => setForm({ ...form, isActive: e.target.value === "active" })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div><label style={labelStyle}>Notes</label><input style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button type="button" className="btn btn-secondary" onClick={() => { setFormOpen(false); setEditingId(null); }} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : editingId ? "Update" : "Create"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={importOpen} title="Import price list" onClose={() => { setImportOpen(false); setPreview(null); }} width={720}>
        <div className="grid gap-3">
          <div className="text-[13px] text-slate-500">
            Upload a CSV or Excel file. Columns are matched by header (Name / Item, Category, Brand, Model, Unit,
            Price, Currency, Valid Until, Lead Time, Notes). Duplicates on (name, brand, model) are skipped.
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" onChange={() => setPreview(null)} />
          {!preview ? (
            <div className="flex justify-end gap-2">
              <button className="btn btn-secondary" onClick={() => { setImportOpen(false); }} disabled={importing}>Cancel</button>
              <button className="btn btn-primary" onClick={() => runImport("preview")} disabled={importing}>
                {importing ? "Reading…" : "Preview"}
              </button>
            </div>
          ) : (
            <>
              <div className="text-[13px] font-semibold">
                {preview.fileName}: {preview.total} rows — {preview.duplicateRows.length} duplicate
                {preview.duplicateRows.length === 1 ? "" : "s"} in file, {preview.errors.length} invalid
              </div>
              <div className="overflow-y-auto border border-slate-200 max-h-[260px] rounded-md">
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    {preview.rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className={`${preview.duplicateRows.includes(i) ? "bg-red-50" : ""}`}>
                        <td className="px-2 py-1 border-b border-b-slate-100 text-slate-400 w-9">{i + 1}</td>
                        <td className="px-2 py-1 border-b border-b-slate-100 font-semibold">{String(r.itemName || "")}</td>
                        <td className="px-2 py-1 border-b border-b-slate-100">{String(r.brand || "")} {String(r.model || "")}</td>
                        <td className="px-2 py-1 border-b border-b-slate-100 text-right">{r.price !== undefined && r.price !== null ? String(r.price) : ""}</td>
                        <td className="px-2 py-1 border-b border-b-slate-100">
                          {preview.duplicateRows.includes(i) ? <Badge color="red">dup</Badge> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.errors.length > 0 && (
                <div className="text-xs text-red-600">
                  {preview.errors.slice(0, 5).map((e, i) => <div key={i}>Row {e.row}: {e.reason}</div>)}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button className="btn btn-secondary" onClick={() => setPreview(null)} disabled={importing}>Back</button>
                <button className="btn btn-primary" onClick={() => runImport("import")} disabled={importing || preview.rows.length === 0}>
                  {importing ? "Importing…" : `Import ${preview.rows.length - preview.duplicateRows.length} products`}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete product"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
