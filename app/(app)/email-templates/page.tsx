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
    <div className="page page-center">
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
          <div className="grid grid-cols-2 gap-4">
            <div><label style={labelStyle}>Template Name *</label><input required style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="IAQ Indoor Air Quality Proposal" /></div>
            <div><label style={labelStyle}>Category</label><input style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="IAQ Proposal, General Vendor Outreach, GC, Architect..." /></div>
            <div className="col-span-2"><label style={labelStyle}>Subject *</label><input required style={inputStyle} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Indoor Air Quality Solutions - {{companyName}}" /></div>
            <div className="col-span-2">
              <div className="flex justify-between items-center mb-1">
                <label style={labelStyle}>Body *</label>
                <button type="button" className="btn btn-ghost text-xs px-2 py-1" onClick={insertMergeTag} title="Insert company name merge tag">
                  + {"{{companyName}}"}
                </button>
              </div>
              <textarea required rows={12} style={{ ...inputStyle, fontFamily: "inherit" }} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Hello {{companyName}}, ..." />
              <p className="text-xs text-slate-400 mt-1">
                Merge tags: <code>{"{{companyName}}"}</code> is replaced with the recipient company&apos;s name when sending.
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
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

      <div className="flex gap-3 mb-4 flex-wrap">
        <SearchInput placeholder="Search templates..." value={search} onChange={(v) => setSearch(v)} />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="page-scroll">
      {loading ? (
        <p className="text-slate-400">Loading templates...</p>
      ) : templates.length === 0 && !search && !categoryFilter && !error ? (
        <EmptyState message="No email templates yet — use + New Template to create the first one." />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 text-center text-slate-400 rounded-lg p-8">
          No templates yet. Create one with <strong>+ New Template</strong>.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((t) => (
            <div key={t.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="flex gap-2 items-center mb-1">
                    <span className="font-semibold">{t.name}</span>
                    {t.category && <span className="badge badge-blue">{t.category}</span>}
                  </div>
                  <div className="text-sm text-slate-700 mb-1.5">Subject: {t.subject}</div>
                  <div className="text-[13px] text-slate-500 whitespace-pre-wrap overflow-hidden max-h-[60px]">{t.body}</div>
                  <div className="text-xs text-slate-400 mt-1.5">
                    Updated {new Date(t.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button className="btn btn-ghost px-2 py-1" onClick={() => handleEdit(t)}>Edit</button>
                  <button className="btn btn-ghost px-2 py-1 text-red-600" onClick={() => setDeleteTarget({ id: t.id, name: t.name })}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
