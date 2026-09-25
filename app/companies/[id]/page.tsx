"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DOCUMENT_CATEGORIES, COMPANY_TYPE_LABELS } from "@/lib/enums";

type Tab = "overview" | "accreditation" | "contacts" | "leads" | "projects" | "activities" | "documents";

interface Company {
  id: string;
  name: string;
  type: string;
  accreditationStatus: string;
  accreditationSubmittedAt: string | null;
  accreditationDecisionAt: string | null;
  industry: string;
  address: string | null;
  website: string | null;
  email: string | null;
  mobile1: string | null;
  mobile2: string | null;
  mobile3: string | null;
  landline1: string | null;
  status: string;
  outreachStatus: string | null;
  notes: string | null;
  source: string | null;
  createdAt: string;
  contacts: { id: string; firstName: string; lastName: string | null; position: string | null; email: string | null; mobile: string | null }[];
  projects: { id: string; projectName: string; status: string; projectLocation: string | null; createdAt: string }[];
  activities: { id: string; type: string; date: string; description: string | null; performedBy: string | null }[];
  leads: { id: string; type: string; status: string; priority: string; estimatedValue: number | null; dateAdded: string }[];
  documents: { id: string; category: string; fileName: string; fileUrl: string; createdAt: string }[];
}

interface Doc { id: string; category: string; fileName: string; fileUrl: string; createdAt: string }

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
];

export default function CompanyDetailPage() {
  const { id } = useParams();
  const [company, setCompany] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [docForm, setDocForm] = useState({ category: "Company Profile", fileName: "", fileUrl: "" });
  const [saving, setSaving] = useState(false);

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

  const setAccreditation = async (status: string, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
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
        await load();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to add document");
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteDocument = async (docId: string) => {
    if (!confirm("Delete this document record?")) return;
    await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    await load();
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading company...</div>;
  if (error) return <div style={{ padding: 24 }}><div style={{ background: "#fef2f2", color: "#dc2626", padding: 12, borderRadius: 8 }}>{error}</div></div>;
  if (!company) return null;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <Link href="/companies" style={{ fontSize: "0.875rem", color: "#3b82f6" }}>← Back to Companies</Link>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, marginBottom: 4 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>{company.name}</h1>
        <span className="badge badge-gray">{TYPE_LABELS[company.type] || company.type}</span>
        {company.accreditationStatus !== "NOT_STARTED" && (
          <span className={`badge ${ACCREDITATION_BADGE[company.accreditationStatus] || "badge-gray"}`}>
            {ACCREDITATION_LABELS[company.accreditationStatus] || company.accreditationStatus}
          </span>
        )}
      </div>
      <p style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: 20 }}>
        {company.industry} • {company.status}{company.outreachStatus ? ` • Outreach: ${company.outreachStatus}` : ""}
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{ padding: "8px 14px", background: activeTab === t.key ? "#1e40af" : "#e2e8f0", color: activeTab === t.key ? "#fff" : "#0f172a", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: "0.8125rem" }}
          >
            {t.label}{t.key === "contacts" ? ` (${company.contacts.length})` : t.key === "leads" ? ` (${company.leads.length})` : t.key === "projects" ? ` (${company.projects.length})` : t.key === "documents" ? ` (${company.documents.length})` : ""}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", rowGap: 10, fontSize: "0.875rem" }}>
            <span style={{ color: "#64748b" }}>Client Type</span><span>{TYPE_LABELS[company.type] || company.type}</span>
            <span style={{ color: "#64748b" }}>Industry</span><span>{company.industry}</span>
            <span style={{ color: "#64748b" }}>Email</span><span>{company.email || "-"}</span>
            <span style={{ color: "#64748b" }}>Mobile</span><span>{[company.mobile1, company.mobile2, company.mobile3].filter(Boolean).join(", ") || "-"}</span>
            <span style={{ color: "#64748b" }}>Landline</span><span>{company.landline1 || "-"}</span>
            <span style={{ color: "#64748b" }}>Address</span><span>{company.address || "-"}</span>
            <span style={{ color: "#64748b" }}>Website</span><span>{company.website || "-"}</span>
            <span style={{ color: "#64748b" }}>Source</span><span>{company.source || "-"}</span>
            <span style={{ color: "#64748b" }}>Status</span><span>{company.status}</span>
            <span style={{ color: "#64748b" }}>Created</span><span>{new Date(company.createdAt).toLocaleDateString("en-PH")}</span>
            {company.notes && (<><span style={{ color: "#64748b" }}>Notes</span><span style={{ whiteSpace: "pre-wrap" }}>{company.notes}</span></>)}
          </div>
        </div>
      )}

      {activeTab === "accreditation" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <span className={`badge ${ACCREDITATION_BADGE[company.accreditationStatus] || "badge-gray"}`} style={{ fontSize: "0.875rem" }}>
              {ACCREDITATION_LABELS[company.accreditationStatus] || company.accreditationStatus}
            </span>
            <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
              {company.accreditationSubmittedAt && `Submitted ${new Date(company.accreditationSubmittedAt).toLocaleDateString("en-PH")}`}
              {company.accreditationSubmittedAt && company.accreditationDecisionAt && " • "}
              {company.accreditationDecisionAt && `Decided ${new Date(company.accreditationDecisionAt).toLocaleDateString("en-PH")}`}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ACCREDITATION_ACTIONS.filter((a) => a.to !== company.accreditationStatus).map((a) => (
              <button key={a.to} className="btn btn-secondary" disabled={saving} onClick={() => setAccreditation(a.to, a.confirm)}>
                {a.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 12 }}>
            Progression: Not Started → Documents Submitted → Under Review → Accredited / Rejected. Timestamps are recorded automatically.
          </p>
        </div>
      )}

      {activeTab === "contacts" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24 }}>
          {company.contacts.length === 0 ? <p style={{ color: "#94a3b8" }}>No contacts yet.</p> : company.contacts.map((c) => (
            <div key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontWeight: 600 }}>{c.firstName} {c.lastName || ""}</span>
              {c.position && <span style={{ color: "#64748b", marginLeft: 8 }}>{c.position}</span>}
              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{c.email || "-"} • {c.mobile || "-"}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "leads" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
          {company.leads.length === 0 ? <p style={{ color: "#94a3b8", padding: 16 }}>No leads yet.</p> : (
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
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
          {company.projects.length === 0 ? <p style={{ color: "#94a3b8", padding: 16 }}>No projects yet.</p> : (
            <table>
              <thead><tr><th>Project</th><th>Location</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {company.projects.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.projectName}</td>
                    <td>{p.projectLocation || "-"}</td>
                    <td>{p.status}</td>
                    <td>{new Date(p.createdAt).toLocaleDateString("en-PH")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "activities" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24 }}>
          {company.activities.length === 0 ? <p style={{ color: "#94a3b8" }}>No activities yet.</p> : company.activities.map((a) => (
            <div key={a.id} style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
              <span className="badge badge-blue">{a.type}</span>
              <span style={{ fontSize: "0.8125rem", color: "#64748b", marginLeft: 8 }}>
                {new Date(a.date).toLocaleDateString("en-PH")}{a.performedBy ? ` • ${a.performedBy}` : ""}
              </span>
              {a.description && <div style={{ fontSize: "0.875rem", marginTop: 4 }}>{a.description}</div>}
            </div>
          ))}
        </div>
      )}

      {activeTab === "documents" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr auto", gap: 8, marginBottom: 16, alignItems: "end" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Category</label>
              <select style={{ width: "100%" }} value={docForm.category} onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}>
                {DOCUMENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>File Name</label>
              <input style={{ width: "100%" }} value={docForm.fileName} onChange={(e) => setDocForm({ ...docForm, fileName: e.target.value })} placeholder="Company-Profile-2026.pdf" />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>File URL</label>
              <input style={{ width: "100%" }} value={docForm.fileUrl} onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })} placeholder="https://..." />
            </div>
            <button className="btn btn-primary" disabled={saving} onClick={addDocument}>Add</button>
          </div>
          {company.documents.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>No documents yet.</p>
          ) : (
            <table>
              <thead><tr><th>Category</th><th>File</th><th>Added</th><th></th></tr></thead>
              <tbody>
                {company.documents.map((d: Doc) => (
                  <tr key={d.id}>
                    <td><span className="badge badge-gray">{d.category}</span></td>
                    <td><a href={d.fileUrl} target="_blank" rel="noreferrer" style={{ color: "#1e40af" }}>{d.fileName}</a></td>
                    <td>{new Date(d.createdAt).toLocaleDateString("en-PH")}</td>
                    <td><button className="btn btn-ghost" style={{ padding: "0.25rem 0.5rem", color: "#dc2626" }} onClick={() => deleteDocument(d.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
