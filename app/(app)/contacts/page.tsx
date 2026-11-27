"use client";

import { useEffect, useState, useCallback } from "react";
import type { Contact, CompanyOption } from "@/lib/types";
import {
  PageHeader,
  ErrorBanner,
  EmptyRow,
  EmptyState,
  Pagination,
  SearchInput,
  Modal,
  ConfirmDialog,
  Badge,
  Button,
} from "@/components/ui";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
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
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchContacts();
    fetch("/api/companies?limit=999")
      .then((r) => r.json())
      .then((d) => setCompanies((d.data || []).map((c: CompanyOption) => ({ id: c.id, name: c.name }))))
      .catch(console.error);
  }, [fetchContacts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/contacts/${editingId}` : "/api/contacts";
    const method = editingId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) { setError("Failed to save - please try again"); return; }
    setShowForm(false);
    setEditingId(null);
    fetchContacts();
  };

  const handleEdit = (c: Contact) => {
    setForm({ companyId: c.company.id, firstName: c.firstName, lastName: c.lastName || "", position: c.position || "", email: c.email || "", mobile: c.mobile || "", landline: c.landline || "", notes: c.notes || "" });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/contacts/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    fetchContacts();
  };

  const handleOptOut = async (c: Contact) => {
    if (!c.email) return;
    setError("");
    try {
      const res = await fetch("/api/emails/opt-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: c.email, undo: c.emailOptOut || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update opt-out");
        return;
      }
      fetchContacts();
    } catch {
      setError("Failed to update opt-out");
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Contacts"
        subtitle={`${total} contacts total`}
        actions={
          <Button variant="primary" onClick={() => { setShowForm(true); setEditingId(null); setForm({ companyId: "", firstName: "", lastName: "", position: "", email: "", mobile: "", landline: "", notes: "" }); }}>
            + Add Contact
          </Button>
        }
      />

      {error && <ErrorBanner message={error} />}

      <Modal open={showForm} title={editingId ? "Edit Contact" : "New Contact"} onClose={() => { setShowForm(false); setEditingId(null); }}>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] font-bold block mb-1 text-ink-muted">Company *</label><select required className="w-full border border-line rounded bg-white" value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
              <option value="">Select company</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
            <div></div>
            <div><label className="text-[11px] font-bold block mb-1 text-ink-muted">First Name *</label><input required className="w-full border border-line rounded bg-white" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
            <div><label className="text-[11px] font-bold block mb-1 text-ink-muted">Last Name</label><input className="w-full border border-line rounded bg-white" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
            <div><label className="text-[11px] font-bold block mb-1 text-ink-muted">Position</label><input className="w-full border border-line rounded bg-white" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
            <div><label className="text-[11px] font-bold block mb-1 text-ink-muted">Email</label><input type="email" className="w-full border border-line rounded bg-white" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="text-[11px] font-bold block mb-1 text-ink-muted">Mobile</label><input className="w-full border border-line rounded bg-white" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="0917-123-4567" /></div>
            <div><label className="text-[11px] font-bold block mb-1 text-ink-muted">Landline</label><input className="w-full border border-line rounded bg-white" value={form.landline} onChange={(e) => setForm({ ...form, landline: e.target.value })} placeholder="(032) 123-4567" /></div>
            <div className="col-span-2"><label className="text-[11px] font-bold block mb-1 text-ink-muted">Notes</label><textarea rows={2} className="w-full border border-line rounded bg-white" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="submit" variant="primary">{editingId ? "Update" : "Create"}</Button>
            <Button variant="secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete contact"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <div className="mb-3">
        <SearchInput placeholder="Search contacts..." width={400} value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
      </div>

      <div className="page-scroll">
        {!loading && contacts.length === 0 && !search && !debouncedSearch && !error ? (
          <EmptyState message="No contacts yet — use + Add Contact to create the first one." />
        ) : (
          <div className="bg-white border border-line overflow-hidden rounded">
            <table className="text-[12px]">
              <thead>
                <tr>
                  <th className="text-ink-muted font-bold text-left pb-2">Name</th>
                  <th className="text-ink-muted font-bold text-left pb-2">Company</th>
                  <th className="text-ink-muted font-bold text-left pb-2">Position</th>
                  <th className="text-ink-muted font-bold text-left pb-2">Email</th>
                  <th className="text-ink-muted font-bold text-left pb-2">Mobile</th>
                  <th className="text-ink-muted font-bold text-left pb-2">Landline</th>
                  <th className="text-ink-muted font-bold text-left pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-b border-[#ecebea]">
                    <td className="py-2 font-medium text-ink">{c.firstName} {c.lastName || ""}</td>
                    <td className="py-2">{c.company.name}</td>
                    <td className="py-2 text-ink-muted">{c.position || "—"}</td>
                    <td className="py-2">
                      {c.email || "—"}
                      {c.emailOptOut && (
                        <span title={`Opted out ${c.emailOptOutAt ? new Date(c.emailOptOutAt).toLocaleString() : ""}`} className="ml-2 text-[10px] font-bold bg-[#fdecec] text-[#970312] border border-[#fdecec] px-1.5 py-[1px] whitespace-nowrap rounded-full">
                          OPTED OUT
                        </span>
                      )}
                    </td>
                    <td className="py-2 whitespace-nowrap text-ink-muted">{c.mobile || "—"}</td>
                    <td className="py-2 whitespace-nowrap text-ink-muted">{c.landline || "—"}</td>
                    <td className="py-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(c)}>Edit</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOptOut(c)}
                        disabled={!c.email}
                        title={c.email ? (c.emailOptOut ? "Undo opt-out (admins only)" : `Mark ${c.email} as opted out`) : "No email address"}
                      >
                        {c.emailOptOut ? "Undo opt-out" : "Opt out"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget({ id: c.id, name: `${c.firstName} ${c.lastName || ""}`.trim() })}>Delete</Button>
                    </td>
                  </tr>
                ))}
                {contacts.length === 0 && <EmptyRow colSpan={7} message={loading ? "Loading…" : "No contacts found"} />}
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
