"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DOCUMENT_CATEGORIES, COMPANY_TYPE_LABELS } from "@/lib/enums";
import type { Company, Document, EmailLog } from "@/lib/types";
import { ErrorBanner, ConfirmDialog, Badge, Button } from "@/components/ui";

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

const ACCREDITATION_STAGE_ORDER: string[] = [
  "NOT_STARTED",
  "DOCUMENTS_SUBMITTED",
  "UNDER_REVIEW",
  "ACCREDITED",
  "REJECTED",
];

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

  if (loading) return <div className="text-center text-ink-muted p-10">Loading company…</div>;
  if (error) return <div className="p-4"><div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-lg">{error}</div></div>;
  if (!company) return null;

  const currentStage = ACCREDITATION_STAGE_ORDER.indexOf(company.accreditationStatus ?? "NOT_STARTED");

  return (
    <div className="page page-center">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-sm" style={{ backgroundColor: "#0176d3" }}>
            <span className="text-[13px] font-bold">{company.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-ink">{company.name}</h1>
              <Badge color="gray">{TYPE_LABELS[company.type] || company.type}</Badge>
              {company.accreditationStatus !== "NOT_STARTED" && (
                <Badge color={company.accreditationStatus === "ACCREDITED" ? "green" : company.accreditationStatus === "REJECTED" ? "red" : "blue"}>
                  {ACCREDITATION_LABELS[company.accreditationStatus]}
                </Badge>
              )}
            </div>
            <p className="text-[13px] text-ink-muted">
              {company.industry} • {company.status}
              {company.outreachStatus ? ` • Outreach: ${company.outreachStatus}` : ""}
            </p>
          </div>
        </div>

        {/* Highlights panel */}
        <div className="grid grid-cols-[250px_1fr_1fr_250px] gap-3">
          <div className="bg-white border border-line rounded px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">Client type</p>
            <p className="text-[13px] font-medium text-ink">{TYPE_LABELS[company.type] || company.type}</p>
          </div>
          <div className="bg-white border border-line rounded px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">Industry</p>
            <p className="text-[13px] font-medium text-ink">{company.industry}</p>
          </div>
          <div className="bg-white border border-line rounded px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">Status</p>
            <p className={`text-[13px] font-medium ${company.status === "Active" ? "text-success" : "text-ink-muted"}`}>{company.status}</p>
          </div>
          <div className="bg-white border border-line rounded px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">Email</p>
            <p className="text-[13px] font-medium text-ink truncate">{company.email || "—"}</p>
          </div>
        </div>
      </div>

      {/* Accreditation path */}
      {company.accreditationStatus !== "NOT_STARTED" && (
        <div className="mb-6">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Accreditation path</span>
          </div>
          <div className="relative h-2">
            {ACCREDITATION_STAGE_ORDER.map((stage, idx) => (
              <div key={stage} className="absolute top-0 h-2 rounded-full">
                <div
                  className="h-full"
                  style={{
                    width: idx <= currentStage ? "100%" : "0%",
                    backgroundColor: idx <= currentStage ? "#0176d3" : "#ecebea",
                    transition: "width 0.3s",
                  }}
                />
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${idx <= currentStage ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-muted"}`}>
                    <span className="text-[10px] font-bold">{idx + 1}</span>
                  </div>
                  <p className="text-[10px] font-medium text-ink-muted text-center w-[70px]">{ACCREDITATION_LABELS[stage]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-line mb-2">
        <div className="flex flex-wrap gap-1 -mb-px">
          {TABS.map((t) => {
            const count = t.key === "contacts" ? company.contacts.length
              : t.key === "leads" ? company.leads.length
              : t.key === "projects" ? company.projects.length
              : t.key === "documents" ? company.documents.length
              : t.key === "activities" ? company.activities.length
              : 0;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`text-[13px] py-3 px-4 border-b-2 ${active
                  ? "border-brand text-brand font-bold"
                  : "border-transparent text-ink-muted hover:border-line hover:bg-shell"
                } no-underline`}
              >
                {t.label}{count > 0 ? ` <span className="ml-1 text-[11px] font-bold opacity-60">(${count})</span>` : ""}
              </button>
            );
          })}
        </div>
      </div>

      <div className="page-scroll">
        {activeTab === "overview" && (
          <div className="bg-white border border-line rounded p-4">
            <div className="grid grid-cols-[170px_1fr] gap-y-2 text-[13px]">
              <span className="text-ink-muted">Client type</span><span className="font-medium">{TYPE_LABELS[company.type] || company.type}</span>
              <span className="text-ink-muted">Industry</span><span className="font-medium">{company.industry}</span>
              <span className="text-ink-muted">Email</span><span className="font-medium truncate">{company.email || "—"}</span>
              <span className="text-ink-muted">Mobile</span>
                <span className="font-medium whitespace-nowrap">{[company.mobile1, company.mobile2, company.mobile3].filter(Boolean).join(", ") || "—"}</span>
              <span className="text-ink-muted">Landline</span><span className="font-medium whitespace-nowrap">{company.landline1 || "—"}</span>
              <span className="text-ink-muted">Address</span><span className="font-medium">{company.address || "—"}</span>
              <span className="text-ink-muted">Website</span><span className="font-medium">{company.website || "—"}</span>
              <span className="text-ink-muted">Source</span><span className="font-medium">{company.source || "—"}</span>
              <span className="text-ink-muted">Status</span><span className="font-medium">{company.status}</span>
              <span className="text-ink-muted">Created</span><span className="font-medium">{new Date(company.createdAt).toLocaleDateString("en-PH")}</span>
              {company.notes && (
                <>
                  <span className="text-ink-muted">Notes</span>
                  <span className="font-medium whitespace-pre-wrap break-words">{company.notes}</span>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === "accreditation" && (
          <div className="bg-white border border-line rounded p-4">
            <div className="flex items-center gap-3 mb-3">
              <Badge color={company.accreditationStatus === "ACCREDITED" ? "green" : company.accreditationStatus === "REJECTED" ? "red" : company.accreditationStatus === "UNDER_REVIEW" ? "yellow" : "gray"}>
                {ACCREDITATION_LABELS[company.accreditationStatus] || company.accreditationStatus}
              </Badge>
              <span className="text-[13px] text-ink-muted">
                {company.accreditationSubmittedAt && `Submitted ${new Date(company.accreditationSubmittedAt).toLocaleDateString("en-PH")}`}
                {company.accreditationSubmittedAt && company.accreditationDecisionAt && " • "}
                {company.accreditationDecisionAt && `Decided ${new Date(company.accreditationDecisionAt).toLocaleDateString("en-PH")}`}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap mb-4">
              {ACCREDITATION_ACTIONS.filter((a) => a.to !== company.accreditationStatus).map((a) => (
                <Button
                  key={a.to}
                  variant="secondary"
                  onClick={() => a.confirm ? setAccredConfirm({ status: a.to, message: a.confirm }) : setAccreditation(a.to)}
                  disabled={saving}
                >
                  {a.label}
                </Button>
              ))}
            </div>
            <p className="text-[12px] text-ink-muted">
              Progression: Not Started → Documents Submitted → Under Review → Accredited / Rejected. Timestamps are recorded automatically.
            </p>
          </div>
        )}

        {activeTab === "contacts" && (
          <div className="bg-white border border-line rounded p-4">
            {company.contacts.length === 0 ? (
              <p className="text-ink-muted">No contacts yet.</p>
            ) : (
              <div>
                {company.contacts.map((c) => (
                  <div key={c.id} className="border-b border-[#ecebea] px-0 py-2.5">
                    <span className="font-medium text-ink">{c.firstName} {c.lastName || ""}</span>
                    {c.position && <span className="ml-2 text-[12px] text-ink-muted">{c.position}</span>}
                    <div className="text-[12px] text-ink-muted">{c.email || "—"} • {c.mobile || "—"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "leads" && (
          <div className="bg-white border border-line rounded overflow-hidden">
            {company.leads.length === 0 ? (
              <p className="text-ink-muted p-4">No leads yet.</p>
            ) : (
              <table className="text-[12px]">
                <thead>
                  <tr>
                    <th className="text-ink-muted font-bold text-left pb-2">Added</th>
                    <th className="text-ink-muted font-bold text-left pb-2">Type</th>
                    <th className="text-ink-muted font-bold text-left pb-2">Status</th>
                    <th className="text-ink-muted font-bold text-left pb-2">Priority</th>
                    <th className="text-ink-muted font-bold text-left pb-2">Est. Value</th>
                  </tr>
                </thead>
                <tbody>
                  {company.leads.map((l) => (
                    <tr key={l.id} className="border-b border-[#ecebea]">
                      <td className="py-2 whitespace-nowrap">{new Date(l.dateAdded).toLocaleDateString("en-PH")}</td>
                      <td className="py-2 whitespace-nowrap">{l.type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())}</td>
                      <td className="py-2 whitespace-nowrap font-medium">{l.status}</td>
                      <td className="py-2 whitespace-nowrap">
                        <Badge color={l.priority === "High" ? "red" : l.priority === "Low" ? "gray" : "blue"}>{l.priority}</Badge>
                      </td>
                      <td className="py-2 whitespace-nowrap">{l.estimatedValue ? `₱${Number(l.estimatedValue).toLocaleString()}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "projects" && (
          <div className="bg-white border border-line rounded overflow-hidden">
            {company.projects.length === 0 ? (
              <p className="text-ink-muted p-4">No projects yet.</p>
            ) : (
              <table className="text-[12px]">
                <thead>
                  <tr>
                    <th className="text-ink-muted font-bold text-left pb-2">Project</th>
                    <th className="text-ink-muted font-bold text-left pb-2">Location</th>
                    <th className="text-ink-muted font-bold text-left pb-2">Status</th>
                    <th className="text-ink-muted font-bold text-left pb-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {company.projects.map((p) => (
                    <tr key={p.id} className="border-b border-[#ecebea]">
                      <td className="py-2 font-medium">{p.projectName}</td>
                      <td className="py-2 whitespace-nowrap">{p.projectLocation || "—"}</td>
                      <td className="py-2 font-medium">{p.status}</td>
                      <td className="py-2 whitespace-nowrap">{p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-PH") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "activities" && (
          <div className="bg-white border border-line rounded p-4">
            {company.activities.length === 0 ? (
              <p className="text-ink-muted">No activities yet.</p>
            ) : (
              <div>
                {company.activities.map((a) => (
                  <div key={a.id} className="border-b border-[#ecebea] px-0 py-2.5">
                    <Badge color="blue">{a.type}</Badge>
                    <span className="ml-2 text-[12px] text-ink-muted">
                      {new Date(a.date).toLocaleDateString("en-PH")}{a.performedBy ? ` • ${a.performedBy}` : ""}
                    </span>
                    {a.description && <div className="text-sm mt-1 text-ink">{a.description}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "documents" && (
          <div className="bg-white border border-line rounded p-4">
            <div className="grid grid-cols-[170px_1fr_1fr_auto] gap-2 mb-3 items-end text-[12px]">
              <div>
                <label className="text-[11px] font-bold block mb-1 text-ink-muted">Category</label>
                <select className="w-full border border-line rounded bg-white" value={docForm.category} onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}>
                  {DOCUMENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold block mb-1 text-ink-muted">File Name</label>
                <input className="w-full border border-line rounded bg-white" value={docForm.fileName} onChange={(e) => setDocForm({ ...docForm, fileName: e.target.value })} placeholder="Company-Profile-2026.pdf" />
              </div>
              <div>
                <label className="text-[11px] font-bold block mb-1 text-ink-muted">File URL</label>
                <input className="w-full border border-line rounded bg-white" value={docForm.fileUrl} onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })} placeholder="https://..." />
              </div>
              <Button variant="primary" disabled={saving} onClick={addDocument}>Add</Button>
            </div>
            <ErrorBanner message={docError} />
            {company.documents.length === 0 ? (
              <p className="text-ink-muted">No documents yet.</p>
            ) : (
              <table className="text-[12px]">
                <thead>
                  <tr>
                    <th className="text-ink-muted font-bold text-left pb-2">Category</th>
                    <th className="text-ink-muted font-bold text-left pb-2">File</th>
                    <th className="text-ink-muted font-bold text-left pb-2">Added</th>
                    <th className="text-ink-muted font-bold text-left pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {company.documents.map((d: Document) => (
                    <tr key={d.id} className="border-b border-[#ecebea]">
                      <td className="py-2"><Badge color="gray">{d.category}</Badge></td>
                      <td className="py-2 whitespace-nowrap">
                        <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-brand">{d.fileName}</a>
                      </td>
                      <td className="py-2 whitespace-nowrap">{new Date(d.createdAt).toLocaleDateString("en-PH")}</td>
                      <td className="py-2">
                        <Button variant="ghost" size="sm" onClick={() => setDocDelete({ id: d.id, name: d.fileName })}>Delete</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "emails" && (
          <div className="bg-white border border-line rounded p-4">
            {!emailsLoaded ? (
              <p className="text-ink-muted">Loading emails…</p>
            ) : emails.length === 0 ? (
              <p className="text-ink-muted">No emails sent to this company or its contacts yet.</p>
            ) : (
              <table className="text-[12px]">
                <thead>
                  <tr>
                    <th className="text-ink-muted font-bold text-left pb-2">Sent</th>
                    <th className="text-ink-muted font-bold text-left pb-2">To</th>
                    <th className="text-ink-muted font-bold text-left pb-2">Subject</th>
                    <th className="text-ink-muted font-bold text-left pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map((m) => (
                    <tr key={m.id} className="border-b border-[#ecebea]">
                      <td className="py-2 whitespace-nowrap">{new Date(m.sentAt).toLocaleDateString("en-PH")}</td>
                      <td className="py-2 whitespace-nowrap">{m.toName ? `${m.toName} · ` : ""}{m.toEmail}</td>
                      <td className="py-2">{m.subject}</td>
                      <td className="py-2">
                        <Badge color={m.status === "SENT" ? "green" : m.status === "FAILED" ? "red" : "yellow"}>{m.status}</Badge>
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
        cancelLabel="Cancel"
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
