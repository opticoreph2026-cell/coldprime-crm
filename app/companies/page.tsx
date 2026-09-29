"use client";

import { useEffect, useState, useCallback } from "react";
import { COMPANY_TYPES, COMPANY_TYPE_LABELS } from "@/lib/enums";
import type { Company } from "@/lib/types";
import { PageHeader, EmptyRow, EmptyState, Pagination, SearchInput, Modal, ConfirmDialog } from "@/components/ui";

const emptyForm = {
  name: "", type: "OTHER", industry: "Other", email: "",
  mobile1: "", mobile2: "", mobile3: "",
  landline1: "", landline2: "", landline3: "",
  address: "", website: "", status: "Active", notes: "", source: "",
};

const TYPE_LABELS = COMPANY_TYPE_LABELS;

const ACCREDITATION_LABELS: Record<string, string> = {
  DOCUMENTS_SUBMITTED: "Docs Submitted",
  UNDER_REVIEW: "Under Review",
  ACCREDITED: "Accredited",
  REJECTED: "Rejected",
};

const ACCREDITATION_BADGE: Record<string, string> = {
  DOCUMENTS_SUBMITTED: "badge-blue",
  UNDER_REVIEW: "badge-yellow",
  ACCREDITED: "badge-green",
  REJECTED: "badge-red",
};

const industries = ["General Contractor", "Architectural", "Construction", "Business Process Outsourcing (BPO)", "Security Systems", "Hotel", "Hospital", "Restaurant", "Retail", "Government", "Manufacturing", "Real Estate", "Education", "IT / Technology", "Healthcare", "Other"];
const fallbackStatuses = ["Active", "Inactive", "Pending", "Prospect", "Archived"];

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [accrFilter, setAccrFilter] = useState("");
  const [outreachFilter, setOutreachFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [apiError, setApiError] = useState("");

  const [mobiles, setMobiles] = useState([""]);
  const [landlines, setLandlines] = useState([""]);
  const [checkingReplies, setCheckingReplies] = useState(false);
  const [replyMsg, setReplyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [statuses, setStatuses] = useState<string[]>(fallbackStatuses);
  const [industryList, setIndustryList] = useState<string[]>(industries);

  useEffect(() => {
    fetch("/api/status-definitions?type=industry")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          const names = d.map((s: { name: string }) => s.name);
          if (names.length > 0) setIndustryList(names);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/status-definitions")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          const companyStatuses = d
            .filter((s: { type: string }) => s.type === "company")
            .map((s: { name: string }) => s.name);
          if (companyStatuses.length > 0) setStatuses(companyStatuses);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCompanies = useCallback(async () => {
    try {
      setApiError("");
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);
      if (accrFilter) params.set("accreditation", accrFilter);
      if (outreachFilter) params.set("outreach", outreachFilter);
      const res = await fetch(`/api/companies?${params}`);
      const data = await res.json();
      if (data.error) {
        setApiError(data.error);
        setCompanies([]);
      } else {
        setCompanies(data.data || []);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch companies:", error);
      setApiError("Failed to load companies");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, outreachFilter, typeFilter, accrFilter]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const syncPhoneFields = (mobs: string[], lins: string[]) => {
    setForm((prev) => ({
      ...prev,
      mobile1: mobs[0] || "", mobile2: mobs[1] || "", mobile3: mobs[2] || "",
      landline1: lins[0] || "", landline2: lins[1] || "", landline3: lins[2] || "",
    }));
  };

  const addMobile = () => { const next = [...mobiles, ""]; setMobiles(next); syncPhoneFields(next, landlines); };
  const removeMobile = (i: number) => { const next = mobiles.filter((_, idx) => idx !== i); setMobiles(next); syncPhoneFields(next, landlines); };
  const updateMobile = (i: number, val: string) => { const next = [...mobiles]; next[i] = val; setMobiles(next); syncPhoneFields(next, landlines); };

  const addLandline = () => { const next = [...landlines, ""]; setLandlines(next); syncPhoneFields(mobiles, next); };
  const removeLandline = (i: number) => { const next = landlines.filter((_, idx) => idx !== i); setLandlines(next); syncPhoneFields(mobiles, next); };
  const updateLandline = (i: number, val: string) => { const next = [...landlines]; next[i] = val; setLandlines(next); syncPhoneFields(mobiles, next); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    const url = editingId ? `/api/companies/${editingId}` : "/api/companies";
    const method = editingId ? "PUT" : "POST";
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm);
        setMobiles([""]);
        setLandlines([""]);
        fetchCompanies();
      } else if (res.status === 409 && data.duplicate) {
        setApiError(`Possible duplicate: "${data.duplicate.name}" (email: ${data.duplicate.email || "none"}, phone: ${data.duplicate.mobile1 || "none"})`);
      } else {
        setApiError(data.error || "Failed to save");
      }
    } catch {
      setApiError("Network error");
    }
  };

  const handleEdit = (c: Company) => {
    setForm({
      name: c.name, type: c.type || "OTHER", industry: c.industry, email: c.email || "",
      mobile1: c.mobile1 || "", mobile2: c.mobile2 || "", mobile3: c.mobile3 || "",
      landline1: c.landline1 || "", landline2: c.landline2 || "", landline3: c.landline3 || "",
      address: c.address || "", website: c.website || "", status: c.status, notes: c.notes || "", source: c.source || "",
    });
    const mobs = [c.mobile1, c.mobile2, c.mobile3].filter((p): p is string => Boolean(p));
    const lins = [c.landline1, c.landline2, c.landline3].filter((p): p is string => Boolean(p));
    setMobiles(mobs.length > 0 ? mobs : [""]);
    setLandlines(lins.length > 0 ? lins : [""]);
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/companies/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    fetchCompanies();
  };

  const handleCheckReplies = async () => {
    setCheckingReplies(true);
    setReplyMsg(null);
    try {
      const res = await fetch("/api/emails/check-replies", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setReplyMsg({
          ok: true,
          text: `Checked ${data.checked} inbox messages — ${data.repliesFound} replies matched${data.companies?.length ? `: ${data.companies.join(", ")}` : ""}.`,
        });
        fetchCompanies();
      } else {
        setReplyMsg({ ok: false, text: data.error || "Reply check failed" });
      }
    } catch {
      setReplyMsg({ ok: false, text: "Reply check failed" });
    } finally {
      setCheckingReplies(false);
    }
  };

  const phoneLabel = (c: Company) => {
    const phones = [c.mobile1, c.mobile2, c.mobile3].filter(Boolean);
    if (phones.length === 0) return "-";
    return phones[0] + (phones.length > 1 ? ` +${phones.length - 1}` : "");
  };

  const landlineLabel = (c: Company) => {
    const lines = [c.landline1, c.landline2, c.landline3].filter(Boolean);
    if (lines.length === 0) return "-";
    return lines[0] + (lines.length > 1 ? ` +${lines.length - 1}` : "");
  };

  const inputStyle = { width: "100%" };
  const labelStyle = { fontSize: "0.75rem", fontWeight: 500 as const, display: "block" as const, marginBottom: 4 };

  return (
<div className="page">
        <PageHeader
          title="Companies"
          subtitle={`${total} potential clients total`}
          actions={
            <>
              <button className="btn btn-secondary" onClick={handleCheckReplies} disabled={checkingReplies}>
                {checkingReplies ? "Checking…" : "🔄 Check replies"}
              </button>
              <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); setMobiles([""]); setLandlines([""]); }}>
                + Add Company
              </button>
            </>
          }
        />

        {replyMsg && (
          <div className={`${`mb-4 ${replyMsg.ok ? "bg-green-100 text-green-800" : "bg-red-50 text-red-600"}`} p-3 rounded-lg`} style={{ border: `1px solid ${replyMsg.ok ? "#bbf7d0" : "#fecaca"}` }}>
            {replyMsg.text}
          </div>
        )}

        {apiError && (
          <div className="bg-red-50 text-red-600 mb-4 border border-red-200 p-3 rounded-lg">
            ⚠️ {apiError} — Please ensure you have a branch selected in the sidebar.
          </div>
        )}

      <Modal open={showForm} title={editingId ? "Edit Company" : "New Company"} onClose={() => { setShowForm(false); setEditingId(null); }}>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div><label style={labelStyle}>Company Name *</label><input required style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label style={labelStyle}>Client Type</label><select style={inputStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{COMPANY_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}</select></div>
            <div><label style={labelStyle}>Industry</label><select style={inputStyle} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>{(industryList.includes(form.industry) ? industryList : [form.industry, ...industryList]).map((i) => <option key={i}>{i}</option>)}</select></div>
            <div><label style={labelStyle}>Email</label><input type="email" style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label style={labelStyle}>Website</label><input style={inputStyle} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
            <div className="col-span-2"><label style={labelStyle}>Address</label><input style={inputStyle} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>

            {/* Mobile Numbers */}
            <div className="col-span-2">
              <label style={{ ...labelStyle, marginBottom: 8, display: "block" }}>Mobile Numbers</label>
              {mobiles.map((val, i) => (
                <div key={i} className="flex gap-2 mb-1.5">
                  <input className="flex-1" value={val} onChange={(e) => updateMobile(i, e.target.value)} placeholder="0917-123-4567" />
                  {mobiles.length > 1 && (
                    <button type="button" onClick={() => removeMobile(i)} className="px-2 py-1 bg-red-100 text-red-600 cursor-pointer text-sm border-0 rounded">✕</button>
                  )}
                </div>
              ))}
              {mobiles.length < 3 && (
                <button type="button" onClick={addMobile} className="px-3 py-1 bg-[#eff6ff] text-blue-800 border border-dashed border-blue-300 cursor-pointer text-xs rounded">+ Add Mobile</button>
              )}
            </div>

            {/* Landline Numbers */}
            <div className="col-span-2">
              <label style={{ ...labelStyle, marginBottom: 8, display: "block" }}>Landline Numbers</label>
              {landlines.map((val, i) => (
                <div key={i} className="flex gap-2 mb-1.5">
                  <input className="flex-1" value={val} onChange={(e) => updateLandline(i, e.target.value)} placeholder="(032) 123-4567" />
                  {landlines.length > 1 && (
                    <button type="button" onClick={() => removeLandline(i)} className="px-2 py-1 bg-red-100 text-red-600 cursor-pointer text-sm border-0 rounded">✕</button>
                  )}
                </div>
              ))}
              {landlines.length < 3 && (
                <button type="button" onClick={addLandline} className="px-3 py-1 bg-[#eff6ff] text-blue-800 border border-dashed border-blue-300 cursor-pointer text-xs rounded">+ Add Landline</button>
              )}
            </div>

            <div><label style={labelStyle}>Status</label><select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label style={labelStyle}>Source</label><input style={inputStyle} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Referral, Website, Walk-in..." /></div>
            <div className="col-span-2"><label style={labelStyle}>Notes</label><textarea rows={2} style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="btn btn-primary">{editingId ? "Update" : "Create"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete company"
        message={`Delete "${deleteTarget?.name}"? Contacts, leads and projects linked to it will also be removed. This cannot be undone.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <div className="flex gap-3 mb-4 flex-wrap">
        <SearchInput placeholder="Search companies..." value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          {COMPANY_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}
        </select>
        <select value={accrFilter} onChange={(e) => { setAccrFilter(e.target.value); setPage(1); }} title="Accreditation status">
          <option value="">All Accreditation</option>
          <option value="NOT_STARTED">Not started</option>
          {Object.keys(ACCREDITATION_LABELS).map((k) => <option key={k} value={k}>{ACCREDITATION_LABELS[k]}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={outreachFilter} onChange={(e) => { setOutreachFilter(e.target.value); setPage(1); }}>
          <option value="">All Outreach</option>
          <option value="NONE">Not emailed</option>
          <option value="EMAILED">Emailed</option>
          <option value="REPLIED">Replied</option>
        </select>
        {apiError && <button className="btn btn-secondary" onClick={fetchCompanies}>Retry</button>}
      </div>

      <div className="page-scroll">
      {apiError ? (
        <div className="bg-white border border-slate-200 text-center text-slate-400 rounded-lg p-8">
          Unable to load companies. Check that a branch is selected and try again.
        </div>
      ) : !loading && companies.length === 0 && !search && !debouncedSearch && !statusFilter && !typeFilter && !accrFilter && !outreachFilter ? (
        <EmptyState message="No companies yet — use + Add Company to create the first one." />
      ) : (
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Type</th>
              <th>Industry</th>
              <th>Email</th>
              <th>Mobile</th>
              <th>Landline</th>
              <th>Status</th>
              <th>Accreditation</th>
              <th>Outreach</th>
              <th>Contacts</th>
              <th>Projects</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">
                  <a href={`/companies/${c.id}`} className="text-blue-800 no-underline">{c.name}</a>
                </td>
                <td><span className="badge badge-gray">{TYPE_LABELS[c.type] || c.type}</span></td>
                <td>{c.industry}</td>
                <td>{c.email || "-"}</td>
                <td className="whitespace-nowrap">{phoneLabel(c)}</td>
                <td className="whitespace-nowrap">{landlineLabel(c)}</td>
                <td><span className={`badge badge-${c.status === "Active" ? "green" : c.status === "Inactive" ? "gray" : "blue"}`}>{c.status}</span></td>
                <td>
                  {c.accreditationStatus && c.accreditationStatus !== "NOT_STARTED" ? (
                    <span className={`badge ${ACCREDITATION_BADGE[c.accreditationStatus] || "badge-gray"}`}>{ACCREDITATION_LABELS[c.accreditationStatus] || c.accreditationStatus}</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td>
                  {c.outreachStatus ? (
                    <span
                      className={`badge badge-${c.outreachStatus === "REPLIED" ? "green" : "blue"}`}
                      title={c.outreachStatus === "REPLIED" && c.lastRepliedAt ? `Replied: ${new Date(c.lastRepliedAt).toLocaleString()}` : c.lastEmailedAt ? `Emailed: ${new Date(c.lastEmailedAt).toLocaleString()}` : ""}
                    >
                      {c.outreachStatus}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td>{c.contacts.length}</td>
                <td>{c.projects.length}</td>
                <td>
                  <button className="btn btn-ghost px-2 py-1" onClick={() => handleEdit(c)}>Edit</button>
                  <button className="btn btn-ghost px-2 py-1 text-red-600" onClick={() => setDeleteTarget({ id: c.id, name: c.name })}>Delete</button>
                </td>
              </tr>
            ))}
            {companies.length === 0 && <EmptyRow colSpan={12} message={loading ? "Loading…" : "No companies found"} />}
          </tbody>
        </table>
      )}
      </div>
      {total > 50 && (
        <Pagination page={page} total={total} onPage={setPage} />
      )}
    </div>
  );
}
