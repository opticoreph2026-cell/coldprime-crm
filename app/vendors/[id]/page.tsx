"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import type { Vendor, VendorContact, VendorMaterial, Document } from "@/lib/types";
import { DOCUMENT_CATEGORIES } from "@/lib/enums";
import { priceValidity } from "@/lib/dates";
import { PageHeader, ErrorBanner, EmptyState, Modal, ConfirmDialog, Badge } from "@/components/ui";

type Tab = "contacts" | "materials" | "documents";
type DeleteTarget = { kind: "contact" | "material" | "document"; id: string; name: string };

const emptyContact = { firstName: "", lastName: "", position: "", email: "", mobile: "" };
const emptyMaterial = { itemName: "", category: "", brand: "", model: "", unit: "", unitPrice: "", priceValidUntil: "", leadTimeDays: "" };
const emptyDoc = { category: "Product Data Sheet", fileName: "", fileUrl: "" };

interface ImportPreview {
  rows: Record<string, unknown>[];
  duplicateRows: number[];
  errors: { row: number; reason: string }[];
  total: number;
}

function ValidityBadge({ value }: { value?: string | null }) {
  const state = priceValidity(value);
  if (state === "none") return <span style={{ color: "#94a3b8" }}>—</span>;
  if (state === "expired") return <Badge color="red">Expired</Badge>;
  if (state === "expiring") return <Badge color="yellow">Expiring</Badge>;
  return <span style={{ whiteSpace: "nowrap" }}>{String(value).slice(0, 10)}</span>;
}

export default function VendorDetailPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  // Client-side mirror of lib/cost.ts canViewVendorCost() (server enforces it).
  const canSeeCost = session?.user?.role === "BRANCH_ADMIN" || session?.user?.role === "HEAD_ADMIN";
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [contacts, setContacts] = useState<VendorContact[]>([]);
  const [materials, setMaterials] = useState<VendorMaterial[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("contacts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [contactModal, setContactModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [contactForm, setContactForm] = useState(emptyContact);
  const [materialModal, setMaterialModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [materialForm, setMaterialForm] = useState(emptyMaterial);
  const [docModal, setDocModal] = useState(false);
  const [docForm, setDocForm] = useState(emptyDoc);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/vendors/${id}`);
      if (!res.ok) { setError("Vendor not found"); return; }
      const data = await res.json();
      setVendor(data);
      setContacts(data.contacts || []);
      setMaterials(data.materials || []);
      const docsRes = await fetch(`/api/documents?vendorId=${id}`);
      const docsData = await docsRes.json();
      setDocs(Array.isArray(docsData) ? docsData : docsData.data || []);
    } catch {
      setError("Failed to load vendor");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const openContact = (c?: VendorContact) => {
    setContactForm(c
      ? { firstName: c.firstName, lastName: c.lastName || "", position: c.position || "", email: c.email || "", mobile: c.mobile || "" }
      : emptyContact);
    setContactModal({ open: true, id: c?.id || null });
    setError("");
  };

  const saveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(contactModal.id ? `/api/vendors/${id}/contacts/${contactModal.id}` : `/api/vendors/${id}/contacts`, {
        method: contactModal.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to save contact");
      } else {
        setContactModal({ open: false, id: null });
        load();
      }
    } finally { setBusy(false); }
  };

  const openMaterial = (m?: VendorMaterial) => {
    setMaterialForm(m
      ? {
          itemName: m.itemName, category: m.category || "", brand: m.brand || "", model: m.model || "",
          unit: m.unit || "", unitPrice: m.unitPrice !== undefined && m.unitPrice !== null ? String(m.unitPrice) : "",
          priceValidUntil: m.priceValidUntil ? String(m.priceValidUntil).slice(0, 10) : "",
          leadTimeDays: m.leadTimeDays !== undefined && m.leadTimeDays !== null ? String(m.leadTimeDays) : "",
        }
      : emptyMaterial);
    setMaterialModal({ open: true, id: m?.id || null });
    setError("");
  };

  const saveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(materialModal.id ? `/api/vendors/${id}/materials/${materialModal.id}` : `/api/vendors/${id}/materials`, {
        method: materialModal.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(materialForm),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to save material");
      } else {
        setMaterialModal({ open: false, id: null });
        load();
      }
    } finally { setBusy(false); }
  };

  const saveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...docForm, vendorId: id }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to add document");
      } else {
        setDocModal(false);
        setDocForm(emptyDoc);
        load();
      }
    } finally { setBusy(false); }
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
      fd.set("vendorId", String(id));
      const res = await fetch("/api/vendors/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Import failed (${res.status})`);
      if (action === "preview") {
        setPreview({ rows: data.rows || [], duplicateRows: data.duplicateRows || [], errors: data.errors || [], total: data.total || 0 });
      } else {
        toast.success(`Imported ${data.imported} items (${data.skipped} skipped as duplicates)`);
        setPreview(null);
        setImportOpen(false);
        if (fileRef.current) fileRef.current.value = "";
        load();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const url = deleteTarget.kind === "contact" ? `/api/vendors/contacts/${deleteTarget.id}`
        : deleteTarget.kind === "material" ? `/api/vendors/materials/${deleteTarget.id}`
        : `/api/documents/${deleteTarget.id}`;
      await fetch(url, { method: "DELETE" });
      setDeleteTarget(null);
      load();
    } finally { setBusy(false); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading vendor...</div>;
  if (!vendor) return <div style={{ padding: 24 }}>{error && <ErrorBanner message={error} />}</div>;

  const tabs: { key: Tab; label: string }[] = [
    { key: "contacts", label: `Contacts (${contacts.length})` },
    { key: "materials", label: `Price List (${materials.length})` },
    { key: "documents", label: `Documents (${docs.length})` },
  ];

  const inputStyle = { width: "100%", padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: 4 };
  const labelStyle = { fontSize: "0.75rem", fontWeight: 500 as const, display: "block" as const, marginBottom: 4 };

  return (
    <div className="page page-center">
      <PageHeader
        title={vendor.name}
        subtitle={`${vendor.category || "Vendor"} • ${vendor.branch.name}`}
        actions={
          <>
            <Badge color={vendor.status === "Active" ? "green" : "gray"}>{vendor.status}</Badge>
            <Link href="/vendors" className="btn btn-secondary">← Back to Vendors</Link>
          </>
        }
      />

      <ErrorBanner message={error} />

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: "8px 16px", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: "0.85rem",
              background: activeTab === t.key ? "#1e40af" : "#e2e8f0",
              color: activeTab === t.key ? "#fff" : "#0f172a",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="page-scroll">
      {activeTab === "contacts" && (
        <div>
          <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => openContact()}>+ Add Contact</button>
          {contacts.length === 0 ? (
            <EmptyState message="No contacts yet — use + Add Contact to add the first one." />
          ) : (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
              {contacts.map((c, i) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: i === 0 ? "none" : "1px solid #f1f5f9" }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{c.firstName} {c.lastName || ""}</span>
                    {c.position && <span style={{ color: "#64748b", marginLeft: 8 }}>{c.position}</span>}
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{[c.email, c.mobile].filter(Boolean).join(" • ") || "—"}</div>
                  </div>
                  <button className="btn btn-ghost" style={{ padding: "0.25rem 0.5rem" }} onClick={() => openContact(c)}>Edit</button>
                  <button className="btn btn-ghost" style={{ padding: "0.25rem 0.5rem", color: "#dc2626" }} onClick={() => setDeleteTarget({ kind: "contact", id: c.id, name: `${c.firstName} ${c.lastName || ""}`.trim() })}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "materials" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => openMaterial()}>+ Add Material</button>
            <button className="btn btn-secondary" onClick={() => { setPreview(null); setImportOpen(true); }}>Import Price List</button>
          </div>
          {materials.length === 0 ? (
            <EmptyState message="No materials listed — use + Add Material to add the first item." />
          ) : (
            <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Item", "Category", "Brand", "Model", "Unit", ...(canSeeCost ? ["Unit Price"] : []), "Lead Time", "Valid Until", ""].map((h, i) => (
                      <th key={i} style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.id}>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9", fontWeight: 600 }}>{m.itemName}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{m.category || "-"}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{m.brand || "-"}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{m.model || "-"}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{m.unit || "-"}</td>
                      {canSeeCost && (
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{m.unitPrice ?? "-"} {m.currency}</td>
                      )}
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                        {m.leadTimeDays !== null && m.leadTimeDays !== undefined ? `${m.leadTimeDays} days` : "-"}
                      </td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}><ValidityBadge value={m.priceValidUntil} /></td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                        <button className="btn btn-ghost" style={{ padding: "0.15rem 0.4rem" }} onClick={() => openMaterial(m)}>Edit</button>
                        <button className="btn btn-ghost" style={{ padding: "0.15rem 0.4rem", color: "#dc2626" }} onClick={() => setDeleteTarget({ kind: "material", id: m.id, name: m.itemName })}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "documents" && (
        <div>
          <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => { setDocForm(emptyDoc); setError(""); setDocModal(true); }}>+ Add Document</button>
          {docs.length === 0 ? (
            <EmptyState message="No documents yet." />
          ) : (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
              {docs.map((d, i) => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: i === 0 ? "none" : "1px solid #f1f5f9" }}>
                  <Badge color="blue">{d.category}</Badge>
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: "0.85rem", color: "#1e40af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.fileName}</a>
                  <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{new Date(d.createdAt).toLocaleDateString()}</span>
                  <button className="btn btn-ghost" style={{ padding: "0.25rem 0.5rem", color: "#dc2626" }} onClick={() => setDeleteTarget({ kind: "document", id: d.id, name: d.fileName })}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>

      <Modal open={contactModal.open} title={contactModal.id ? "Edit Contact" : "Add Contact"} onClose={() => setContactModal({ open: false, id: null })} width={520}>
        <form onSubmit={saveContact} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={labelStyle}>First Name *</label><input required style={inputStyle} value={contactForm.firstName} onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })} /></div>
          <div><label style={labelStyle}>Last Name</label><input style={inputStyle} value={contactForm.lastName} onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })} /></div>
          <div><label style={labelStyle}>Position</label><input style={inputStyle} value={contactForm.position} onChange={(e) => setContactForm({ ...contactForm, position: e.target.value })} /></div>
          <div><label style={labelStyle}>Mobile</label><input style={inputStyle} value={contactForm.mobile} onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })} /></div>
          <div style={{ gridColumn: "span 2" }}><label style={labelStyle}>Email</label><input type="email" style={inputStyle} value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} /></div>
          <div style={{ gridColumn: "span 2", display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setContactModal({ open: false, id: null })} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : contactModal.id ? "Update" : "Add"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={materialModal.open} title={materialModal.id ? "Edit Material" : "Add Material"} onClose={() => setMaterialModal({ open: false, id: null })} width={560}>
        <form onSubmit={saveMaterial} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "span 2" }}><label style={labelStyle}>Item Name *</label><input required style={inputStyle} value={materialForm.itemName} onChange={(e) => setMaterialForm({ ...materialForm, itemName: e.target.value })} /></div>
          <div><label style={labelStyle}>Category</label><input style={inputStyle} value={materialForm.category} onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })} /></div>
          <div><label style={labelStyle}>Brand</label><input style={inputStyle} value={materialForm.brand} onChange={(e) => setMaterialForm({ ...materialForm, brand: e.target.value })} /></div>
          <div><label style={labelStyle}>Model</label><input style={inputStyle} value={materialForm.model} onChange={(e) => setMaterialForm({ ...materialForm, model: e.target.value })} /></div>
          <div><label style={labelStyle}>Unit</label><input style={inputStyle} value={materialForm.unit} onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })} placeholder="pcs, box, roll..." /></div>
          {canSeeCost && (
            <div><label style={labelStyle}>Unit Price (cost)</label><input type="number" step="0.01" min="0" style={inputStyle} value={materialForm.unitPrice} onChange={(e) => setMaterialForm({ ...materialForm, unitPrice: e.target.value })} /></div>
          )}
          <div><label style={labelStyle}>Lead Time (days)</label><input type="number" min="0" style={inputStyle} value={materialForm.leadTimeDays} onChange={(e) => setMaterialForm({ ...materialForm, leadTimeDays: e.target.value })} /></div>
          <div><label style={labelStyle}>Price Valid Until</label><input type="date" style={inputStyle} value={materialForm.priceValidUntil} onChange={(e) => setMaterialForm({ ...materialForm, priceValidUntil: e.target.value })} /></div>
          <div style={{ gridColumn: "span 2", display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setMaterialModal({ open: false, id: null })} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : materialModal.id ? "Update" : "Add"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={docModal} title="Add Document" onClose={() => setDocModal(false)} width={520}>
        <form onSubmit={saveDoc} style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={labelStyle}>Category *</label>
            <select style={inputStyle} value={docForm.category} onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}>
              {DOCUMENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>File Name *</label><input required style={inputStyle} value={docForm.fileName} onChange={(e) => setDocForm({ ...docForm, fileName: e.target.value })} /></div>
          <div><label style={labelStyle}>File URL *</label><input required type="url" style={inputStyle} value={docForm.fileUrl} onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })} placeholder="https://..." /></div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setDocModal(false)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Add"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={importOpen} title="Import price list" onClose={() => { setImportOpen(false); setPreview(null); }} width={720}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: "0.8125rem", color: "#64748b" }}>
            Upload a CSV or Excel file with columns like Item Name, Category, Brand, Model, Unit, Unit Price,
            Valid Until, Lead Time. Every row is added to this vendor. Duplicates on (vendor, brand, model) are skipped.
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" onChange={() => setPreview(null)} />
          {!preview ? (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setImportOpen(false)} disabled={importing}>Cancel</button>
              <button className="btn btn-primary" onClick={() => runImport("preview")} disabled={importing}>
                {importing ? "Reading…" : "Preview"}
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                {preview.total} rows — {preview.duplicateRows.length} duplicate{preview.duplicateRows.length === 1 ? "" : "s"}, {preview.errors.length} invalid
              </div>
              <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                  <tbody>
                    {preview.rows.slice(0, 100).map((r, i) => (
                      <tr key={i} style={{ background: preview.duplicateRows.includes(i) ? "#fef2f2" : undefined }}>
                        <td style={{ padding: "4px 8px", borderBottom: "1px solid #f1f5f9", color: "#94a3b8", width: 36 }}>{i + 1}</td>
                        <td style={{ padding: "4px 8px", borderBottom: "1px solid #f1f5f9", fontWeight: 600 }}>{String(r.itemName || "")}</td>
                        <td style={{ padding: "4px 8px", borderBottom: "1px solid #f1f5f9" }}>{String(r.brand || "")} {String(r.model || "")}</td>
                        {canSeeCost && (
                          <td style={{ padding: "4px 8px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>{r.price !== undefined && r.price !== null ? String(r.price) : ""}</td>
                        )}
                        <td style={{ padding: "4px 8px", borderBottom: "1px solid #f1f5f9" }}>
                          {preview.duplicateRows.includes(i) ? <Badge color="red">dup</Badge> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.errors.length > 0 && (
                <div style={{ fontSize: "0.75rem", color: "#dc2626" }}>
                  {preview.errors.slice(0, 5).map((e, i) => <div key={i}>Row {e.row}: {e.reason}</div>)}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setPreview(null)} disabled={importing}>Back</button>
                <button className="btn btn-primary" onClick={() => runImport("import")} disabled={importing || preview.rows.length === 0}>
                  {importing ? "Importing…" : `Import ${preview.rows.length - preview.duplicateRows.length} items`}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete ${deleteTarget?.kind || "item"}`}
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
