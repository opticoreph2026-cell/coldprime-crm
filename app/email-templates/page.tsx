"use client";

import { useEffect, useState, useCallback } from "react";
import type { EmailTemplate as Template } from "@/lib/types";
import { PageHeader, ErrorBanner, EmptyState, SearchInput, Modal, ConfirmDialog } from "@/components/ui";

const emptyForm = { name: "", subject: "", body: "", category: "" };

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/emails/templates");
      const data = await res.json();
      if (data.error) setError(data.error);
      else setTemplates(data.data || []);
    } catch {
      setError("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const categories = [...new Set(templates.map((t) => t.category).filter(Boolean))] as string[];

  const filtered = templates.filter((t) => {
    if (categoryFilter && t.category !== categoryFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q) || (t.category || "").toLowerCase().includes(q);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const url = editingId ? `/api/emails/templates/${editingId}` : "/api/emails/templates";
    const method = editingId ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, category: form.category || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm);
        fetchTemplates();
      } else {
        setError(data.error || "Failed to save template");
      }
    } catch {
      setError("Network error");
    }
  };

  const handleEdit = (t: Template) => {
    setForm({ name: t.name, subject: t.subject, body: t.body, category: t.category || "" });
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/emails/templates/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    fetchTemplates();
  };

  const insertMergeTag = () => {
    setForm((f) => ({ ...f, body: f.body + "{{companyName}}" }));
  };

  const inputStyle = { width: "100%" };
  const labelStyle = { fontSize: "0.75rem", fontWeight: 500 as const, display: "block" as const, marginBottom: 4 };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <PageHeader
        title="Email Templates"
        subtitle={`${templates.length} reusable templates — use them in Bulk Send and Compose`}
        actions={
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}>
            + New Template
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

      <Modal open={showForm} title={editingId ? "Edit Template" : "New Template"} onClose={() => { setShowForm(false); setEditingId(null); }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div><label style={labelStyle}>Template Name *</label><input required style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="IAQ Indoor Air Quality Proposal" /></div>
            <div><label style={labelStyle}>Category</label><input style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="IAQ Proposal, General Vendor Outreach, GC, Architect..." /></div>
            <div style={{ gridColumn: "span 2" }}><label style={labelStyle}>Subject *</label><input required style={inputStyle} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Indoor Air Quality Solutions - {{companyName}}" /></div>
            <div style={{ gridColumn: "span 2" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label style={labelStyle}>Body *</label>
                <button type="button" className="btn btn-ghost" style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }} onClick={insertMergeTag} title="Insert company name merge tag">
                  + {"{{companyName}}"}
                </button>
              </div>
              <textarea required rows={12} style={{ ...inputStyle, fontFamily: "inherit" }} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Hello {{companyName}}, ..." />
              <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>
                Merge tags: <code>{"{{companyName}}"}</code> is replaced with the recipient company&apos;s name when sending.
              </p>
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary">{editingId ? "Update" : "Create"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete template"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <SearchInput placeholder="Search templates..." value={search} onChange={(v) => setSearch(v)} />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ color: "#94a3b8" }}>Loading templates...</p>
      ) : templates.length === 0 && !search && !categoryFilter && !error ? (
        <EmptyState
          message="No email templates yet — create your first template to get started."
          action={
            <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}>
              + New Template
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 32, textAlign: "center", color: "#94a3b8" }}>
          No templates yet. Create one with <strong>+ New Template</strong>.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {filtered.map((t) => (
            <div key={t.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{t.name}</span>
                    {t.category && <span className="badge badge-blue">{t.category}</span>}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#334155", marginBottom: 6 }}>Subject: {t.subject}</div>
                  <div style={{ fontSize: "0.8125rem", color: "#64748b", whiteSpace: "pre-wrap", maxHeight: 60, overflow: "hidden" }}>{t.body}</div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 6 }}>
                    Updated {new Date(t.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-ghost" style={{ padding: "0.25rem 0.5rem" }} onClick={() => handleEdit(t)}>Edit</button>
                  <button className="btn btn-ghost" style={{ padding: "0.25rem 0.5rem", color: "#dc2626" }} onClick={() => setDeleteTarget({ id: t.id, name: t.name })}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
