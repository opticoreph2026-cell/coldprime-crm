"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DOCUMENT_CATEGORIES, COMPANY_TYPE_LABELS } from "@/lib/enums";
import type { Company, Document, EmailLog } from "@/lib/types";
import { ErrorBanner, ConfirmDialog } from "@/components/ui";

type Tab = "overview" | "accreditation" | "contacts" | "leads" | "projects" | "activities" | "documents" | "emails";

const TYPE_LABELS = COMPANY_TYPE_LABELS;

const ACCREDITATION_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  DOCUMENTS_SUBMITTED: "Documents Submitted",
  UNDER_REVIEW: "Under Review",
  ACCREDITED: "Accredited",
  REJECTED: "Rejected",
};

const ACCREDITATION_BADGE: Record<string, string> = {
  NOT_STARTED: "badge-gray",
  DOCUMENTS_SUBMITTED: "badge-blue",
  UNDER_REVIEW: "badge-yellow",
  ACCREDITED: "badge-green",
  REJECTED: "badge-red",
};

const ACCREDITATION_ACTIONS: { to: string; label: string; confirm?: string }[] = [
  { to: "DOCUMENTS_SUBMITTED", label: "Submit Documents" },
  { to: "UNDER_REVIEW", label: "Mark Under Review" },
  { to: "ACCREDITED", label: "Accredit", confirm: "Mark this company as ACCREDITED?" },
  { to: "REJECTED", label: "Reject", confirm: "Mark this company as REJECTED?" },
  { to: "NOT_STARTED", label: "Reset", confirm: "Reset accreditation progress?" },
];

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "accreditation", label: "Accreditation" },
  { key: "contacts", label: "Contacts" },
  { key: "leads", label: "Leads" },
  { key: "projects", label: "Projects" },
  { key: "activities", label: "Activities" },
  { key: "documents", label: "Documents" },
  { key: "emails", label: "Emails" },
];

export default function CompanyDetailPage() {
  const { id } = useParams();
  const [company, setCompany] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [docForm, setDocForm] = useState({ category: "Company Profile", fileName: "", fileUrl: "" });
  const [saving, setSaving] = useState(false);
  const [accredConfirm, setAccredConfirm] = useState<{ status: string; message: string } | null>(null);
  const [docDelete, setDocDelete] = useState<{ id: string; name: string } | null>(null);
  const [docError, setDocError] = useState("");
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [emailsLoaded, setEmailsLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${id}`);
      if (!res.ok) { setError("Company not found"); return; }
      setCompany(await res.json());
    } catch {
      setError("Failed to load company");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (activeTab !== "emails" || emailsLoaded || !company) return;
    const set = new Set<string>();
    if (company.email) set.add(company.email.toLowerCase());
    for (const c of company.contacts) if (c.email) set.add(c.email.toLowerCase());
    if (set.size === 0) { setEmailsLoaded(true); return; }
    fetch(`/api/emails/logs?to=${[...set].map(encodeURIComponent).join(",")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.data)) setEmails(d.data); })
      .catch(() => { /* keep empty */ })
      .finally(() => setEmailsLoaded(true));
  }, [activeTab, emailsLoaded, company]);

  const setAccreditation = async (status: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accreditationStatus: status }),
      });
      if (res.ok) setCompany(await res.json());
    } finally {
      setSaving(false);
    }
  };

  const addDocument = async () => {
    if (!docForm.fileName.trim() || !docForm.fileUrl.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...docForm, companyId: id }),
      });
      if (res.ok) {
        setDocForm({ category: "Company Profile", fileName: "", fileUrl: "" });
        setDocError("");
        await load();
      } else {
        const d = await res.json();
        setDocError(d.error || "Failed to add document");
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteDocument = async () => {
    if (!docDelete) return;
    await fetch(`/api/documents/${docDelete.id}`, { method: "DELETE" });
    setDocDelete(null);
    await load();
  };

  if (loading) return <div className="text-center text-slate-400 p-10">Loading company...</div>;
  if (error) return <div className="p-6"><div className="bg-red-50 text-red-600 p-3 rounded-lg">{error}</div></div>;
  if (!company) return null;

  return (
    <div className="page page-center">
      <Link href="/companies" className="text-sm text-blue-500">← Back to Companies</Link>
      <div className="flex items-center gap-3 mt-2 mb-1">
        <h1 className="text-2xl font-bold">{company.name}</h1>
        <span className="badge badge-gray">{TYPE_LABELS[company.type] || company.type}</span>
        {company.accreditationStatus !== "NOT_STARTED" && (
          <span className={`badge ${ACCREDITATION_BADGE[company.accreditationStatus] || "badge-gray"}`}>
            {ACCREDITATION_LABELS[company.accreditationStatus] || company.accreditationStatus}
          </span>
        )}
      </div>
      <p className="text-slate-500 text-sm mb-5">
        {company.industry} • {company.status}{company.outreachStatus ? ` • Outreach: ${company.outreachStatus}` : ""}
      </p>

      <div className="flex gap-1.5 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)} className={`${`${`px-3.5 py-2 cursor-pointer font-semibold text-[13px] ${activeTab === t.key ? "bg-blue-800 text-white" : "bg-slate-200 text-slate-900"}`} border-0`} rounded-md`}
          >
            {t.label}{t.key === "contacts" ? ` (${company.contacts.length})` : t.key === "leads" ? ` (${company.leads.length})` : t.key === "projects" ? ` (${company.projects.length})` : t.key === "documents" ? ` (${company.documents.length})` : ""}
          </button>
        ))}
      </div>

      <div className="page-scroll">
      {activeTab === "overview" && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="grid grid-cols-[160px_1fr] gap-y-2.5 text-sm">
            <span className="text-slate-500">Client Type</span><span>{TYPE_LABELS[company.type] || company.type}</span>
            <span className="text-slate-500">Industry</span><span>{company.industry}</span>
            <span className="text-slate-500">Email</span><span>{company.email || "-"}</span>
            <span className="text-slate-500">Mobile</span><span>{[company.mobile1, company.mobile2, company.mobile3].filter(Boolean).join(", ") || "-"}</span>
            <span className="text-slate-500">Landline</span><span>{company.landline1 || "-"}</span>
            <span className="text-slate-500">Address</span><span>{company.address || "-"}</span>
            <span className="text-slate-500">Website</span><span>{company.website || "-"}</span>
            <span className="text-slate-500">Source</span><span>{company.source || "-"}</span>
            <span className="text-slate-500">Status</span><span>{company.status}</span>
            <span className="text-slate-500">Created</span><span>{new Date(company.createdAt).toLocaleDateString("en-PH")}</span>
            {company.notes && (<><span className="text-slate-500">Notes</span><span className="whitespace-pre-wrap">{company.notes}</span></>)}
          </div>
        </div>
      )}

      {activeTab === "accreditation" && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className={`${`badge ${ACCREDITATION_BADGE[company.accreditationStatus] || "badge-gray"}`} text-sm`}>
              {ACCREDITATION_LABELS[company.accreditationStatus] || company.accreditationStatus}
            </span>
            <span className="text-[13px] text-slate-500">
              {company.accreditationSubmittedAt && `Submitted ${new Date(company.accreditationSubmittedAt).toLocaleDateString("en-PH")}`}
              {company.accreditationSubmittedAt && company.accreditationDecisionAt && " • "}
              {company.accreditationDecisionAt && `Decided ${new Date(company.accreditationDecisionAt).toLocaleDateString("en-PH")}`}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {ACCREDITATION_ACTIONS.filter((a) => a.to !== company.accreditationStatus).map((a) => (
              <button key={a.to} className="btn btn-secondary" disabled={saving} onClick={() => a.confirm ? setAccredConfirm({ status: a.to, message: a.confirm }) : setAccreditation(a.to)}>
                {a.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Progression: Not Started → Documents Submitted → Under Review → Accredited / Rejected. Timestamps are recorded automatically.
          </p>
        </div>
      )}

      {activeTab === "contacts" && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          {company.contacts.length === 0 ? <p className="text-slate-400">No contacts yet.</p> : company.contacts.map((c) => (
            <div key={c.id} className="border-b border-b-slate-100 px-0 py-2.5">
              <span className="font-semibold">{c.firstName} {c.lastName || ""}</span>
              {c.position && <span className="text-slate-500 ml-2">{c.position}</span>}
              <div className="text-xs text-slate-500">{c.email || "-"} • {c.mobile || "-"}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "leads" && (
        <div className="bg-white border border-slate-200 overflow-hidden rounded-lg">
          {company.leads.length === 0 ? <p className="text-slate-400 p-4">No leads yet.</p> : (
            <table>
              <thead><tr><th>Added</th><th>Type</th><th>Status</th><th>Priority</th><th>Est. Value</th></tr></thead>
              <tbody>
                {company.leads.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.dateAdded).toLocaleDateString("en-PH")}</td>
                    <td>{l.type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())}</td>
                    <td>{l.status}</td>
                    <td><span className={`badge badge-${l.priority === "High" ? "red" : l.priority === "Low" ? "gray" : "blue"}`}>{l.priority}</span></td>
                    <td>{l.estimatedValue ? `₱${Number(l.estimatedValue).toLocaleString()}` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "projects" && (
        <div className="bg-white border border-slate-200 overflow-hidden rounded-lg">
          {company.projects.length === 0 ? <p className="text-slate-400 p-4">No projects yet.</p> : (
            <table>
              <thead><tr><th>Project</th><th>Location</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {company.projects.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.projectName}</td>
                    <td>{p.projectLocation || "-"}</td>
                    <td>{p.status}</td>
                    <td>{p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-PH") : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "activities" && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          {company.activities.length === 0 ? <p className="text-slate-400">No activities yet.</p> : company.activities.map((a) => (
            <div key={a.id} className="border-b border-b-slate-100 px-0 py-2.5">
              <span className="badge badge-blue">{a.type}</span>
              <span className="text-[13px] text-slate-500 ml-2">
                {new Date(a.date).toLocaleDateString("en-PH")}{a.performedBy ? ` • ${a.performedBy}` : ""}
              </span>
              {a.description && <div className="text-sm mt-1">{a.description}</div>}
            </div>
          ))}
        </div>
      )}

      {activeTab === "documents" && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="grid grid-cols-[160px_1fr_1fr_auto] gap-2 mb-4 items-end">
            <div>
              <label className="text-xs font-medium block mb-1">Category</label>
              <select className="w-full" value={docForm.category} onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}>
                {DOCUMENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">File Name</label>
              <input className="w-full" value={docForm.fileName} onChange={(e) => setDocForm({ ...docForm, fileName: e.target.value })} placeholder="Company-Profile-2026.pdf" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">File URL</label>
              <input className="w-full" value={docForm.fileUrl} onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })} placeholder="https://..." />
            </div>
            <button className="btn btn-primary" disabled={saving} onClick={addDocument}>Add</button>
          </div>
          <ErrorBanner message={docError} />
          {company.documents.length === 0 ? (
            <p className="text-slate-400">No documents yet.</p>
          ) : (
            <table>
              <thead><tr><th>Category</th><th>File</th><th>Added</th><th></th></tr></thead>
              <tbody>
                {company.documents.map((d: Document) => (
                  <tr key={d.id}>
                    <td><span className="badge badge-gray">{d.category}</span></td>
                    <td><a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-blue-800">{d.fileName}</a></td>
                    <td>{new Date(d.createdAt).toLocaleDateString("en-PH")}</td>
                    <td><button className="btn btn-ghost px-2 py-1 text-red-600" onClick={() => setDocDelete({ id: d.id, name: d.fileName })}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "emails" && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          {!emailsLoaded ? (
            <p className="text-slate-400">Loading emails…</p>
          ) : emails.length === 0 ? (
            <p className="text-slate-400">No emails sent to this company or its contacts yet.</p>
          ) : (
            <table>
              <thead><tr><th>Sent</th><th>To</th><th>Subject</th><th>Status</th></tr></thead>
              <tbody>
                {emails.map((m) => (
                  <tr key={m.id}>
                    <td>{new Date(m.sentAt).toLocaleDateString("en-PH")}</td>
                    <td>{m.toName ? `${m.toName} · ` : ""}{m.toEmail}</td>
                    <td>{m.subject}</td>
                    <td>
                      <span className={`badge ${m.status === "SENT" ? "badge-green" : m.status === "FAILED" ? "badge-red" : "badge-yellow"}`}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      </div>

      <ConfirmDialog
        open={accredConfirm !== null}
        title="Confirm accreditation change"
        message={accredConfirm?.message || ""}
        confirmLabel="Continue"
        danger={false}
        busy={saving}
        onCancel={() => setAccredConfirm(null)}
        onConfirm={async () => {
          if (accredConfirm) await setAccreditation(accredConfirm.status);
          setAccredConfirm(null);
        }}
      />

      <ConfirmDialog
        open={docDelete !== null}
        title="Delete document"
        message={`Delete "${docDelete?.name}"? This only removes the record — the linked file itself is not touched.`}
        onCancel={() => setDocDelete(null)}
        onConfirm={deleteDocument}
      />
    </div>
  );
}
