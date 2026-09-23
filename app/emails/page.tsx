"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string | null;
}

interface Recipient {
  id?: string;
  email: string;
  name: string | null;
  type: "contact" | "company";
  companyName?: string;
  industry?: string;
}

interface EmailLog {
  id: string;
  toEmail: string;
  toName: string | null;
  subject: string;
  status: string;
  sentAt: string;
  errorCode: string | null;
}

const DEFAULT_SUBJECT = "Application for Accreditation as HVAC & IAQ Vendor – Coldprime Enterprises Corporation";

const DEFAULT_BODY = `Good day,

I hope this email finds you well. My name is [Your Name], Sales Engineer at Coldprime Enterprises Corporation, an HVAC and Indoor Air Quality contractor with our main office in Makati and a branch office in Cebu.

I'm reaching out to inquire about the possibility of Coldprime being accredited as an HVAC/IAQ vendor or subcontractor for [Company Name]. We specialize in HVAC system design, supply, and installation, along with IAQ compliance solutions for commercial, industrial, and institutional developments.

If you're not the right point of contact for vendor accreditation, I'd greatly appreciate it if you could forward this email to your procurement or purchasing department. Please let us know if there are specific requirements or forms we should complete, and we'll gladly send over our company profile and supporting documents.

Would it also be alright if I gave you a call to briefly discuss this further? Please let me know a convenient time, or feel free to reach me directly at [Phone].

Thank you for your time, and I look forward to hearing from you.

Best regards,
[Your Name]
Sales Engineer, Coldprime Enterprises Corporation
[Phone] | [Email]`;

const BATCH_SIZE = 10;

export default function EmailsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [activeTab, setActiveTab] = useState<"bulk" | "templates" | "sent">("bulk");
  const [loading, setLoading] = useState(true);

  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [senderName, setSenderName] = useState("");
  const [phone, setPhone] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [skipAlreadySent, setSkipAlreadySent] = useState(true);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [templateName, setTemplateName] = useState("Vendor Accreditation");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [recipSearch, setRecipSearch] = useState("");
  const [sendLimit, setSendLimit] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (session?.user) {
      setSenderName((prev) => prev || session.user.name || "");
      setSenderEmail((prev) => prev || session.user.email || "");
    }
  }, [session]);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p && !p.error) {
          setSenderName(p.name || "");
          setPhone(p.phone || "");
          setSenderEmail(p.signatureEmail || p.email || "");
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/emails/templates").then((r) => r.json()),
      fetch("/api/emails").then((r) => r.json()),
      fetch("/api/emails/logs").then((r) => r.json()),
    ])
      .then(([tplRes, recRes, logRes]) => {
        setTemplates(tplRes.data || []);
        const recData = recRes.contacts || [];
        const compData = recRes.companies || [];
        const allRecipients: Recipient[] = [
          ...recData.map((c: { email: string; firstName: string; lastName?: string; company?: { name: string } }) => ({
            email: c.email,
            name: `${c.firstName} ${c.lastName || ""}`.trim(),
            type: "contact" as const,
            companyName: c.company?.name,
          })),
          ...compData.map((c: { id: string; email: string; name: string; industry?: string }) => ({
            id: c.id,
            email: c.email,
            name: c.name,
            type: "company" as const,
            industry: c.industry,
          })),
        ];
        setRecipients(allRecipients);
        setSelectedIds(compData.map((c: { id: string }) => c.id));
        setLogs(logRes.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const companyTargets = recipients.filter((r) => r.type === "company" && r.id);
  const selectedSet = new Set(selectedIds);
  let finalTargets = companyTargets.filter((c) => selectedSet.has(c.id!));
  const limitNum = parseInt(sendLimit, 10);
  if (limitNum > 0) finalTargets = finalTargets.slice(0, limitNum);

  const filteredCompanies = companyTargets.filter((c) => {
    if (!recipSearch.trim()) return true;
    const q = recipSearch.toLowerCase();
    return (c.name || "").toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: senderName, phone, signatureEmail: senderEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotice("Your details saved — they will be prefilled next time.");
      } else {
        setError(data.error || "Failed to save details");
      }
    } catch {
      setError("Failed to save details");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleBulkSend = async () => {
    if (!subject.trim() || !body.trim()) {
      setError("Subject and body are required");
      return;
    }
    if (finalTargets.length === 0) {
      setError("Select at least one company to send to");
      return;
    }
    if (!window.confirm(`Send this email to ${finalTargets.length} companies? This cannot be undone.`)) return;

    setError("");
    setNotice("");
    setResult(null);
    setSending(true);

    const finalBody = body
      .split("[Your Name]").join(senderName)
      .split("[Phone]").join(phone)
      .split("[Email]").join(senderEmail);

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const ids = finalTargets.map((t) => t.id!);

    try {
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE);
        setProgress({ done: Math.min(i + BATCH_SIZE, ids.length), total: ids.length });
        const res = await fetch("/api/emails/bulk-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, body: finalBody, companyIds: chunk, skipAlreadySent, senderName }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Bulk send failed");
          break;
        }
        sent += data.sent || 0;
        failed += data.failed || 0;
        skipped += data.skipped || 0;
      }
      setResult({ sent, failed, skipped });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Bulk send failed");
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      setError("Enter a template name");
      return;
    }
    setNotice("");
    setError("");
    setSavingTemplate(true);
    try {
      const res = await fetch("/api/emails/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, body, category: "HVAC" }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotice(`Template "${name}" saved.`);
        setTemplates((prev) => [
          { id: data.id, name: data.name, subject: data.subject, body: data.body, category: data.category },
          ...prev,
        ]);
        setShowSaveForm(false);
      } else {
        setError(data.error || "Failed to save template");
      }
    } catch {
      setError("Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const startEdit = (tpl: Template) => {
    setEditingId(tpl.id);
    setExpandedId(tpl.id);
    setEditName(tpl.name);
    setEditSubject(tpl.subject);
    setEditBody(tpl.body || "");
    setEditCategory(tpl.category || "");
    setError("");
    setNotice("");
  };

  const handleUpdateTemplate = async () => {
    if (!editingId) return;
    const name = editName.trim();
    if (!name || !editSubject.trim() || !editBody.trim()) {
      setError("Name, subject, and body are required");
      return;
    }
    setSavingEdit(true);
    setError("");
    try {
      const res = await fetch(`/api/emails/templates/${encodeURIComponent(editingId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject: editSubject, body: editBody, category: editCategory || null }),
      });
      const data = await res.json();
      if (res.ok) {
        const updated = data.data || data;
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === editingId
              ? { ...t, name: updated.name ?? name, subject: updated.subject ?? editSubject, body: updated.body ?? editBody, category: (updated.category ?? editCategory) || null }
              : t
          )
        );
        setEditingId(null);
        setNotice("Template updated.");
      } else {
        setError(data.error || "Failed to update template");
      }
    } catch {
      setError("Failed to update template");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteTemplate = async (tpl: Template) => {
    if (!window.confirm(`Delete template "${tpl.name}"? This cannot be undone.`)) return;
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/emails/templates/${encodeURIComponent(tpl.id)}`, { method: "DELETE" });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
        setNotice(`Template "${tpl.name}" deleted.`);
        if (editingId === tpl.id) setEditingId(null);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete template");
      }
    } catch {
      setError("Failed to delete template");
    }
  };

  const loadIntoBulk = (tpl: Template) => {
    setSubject(tpl.subject);
    setBody(tpl.body || "");
    setActiveTab("bulk");
    setResult(null);
    setNotice(`Template "${tpl.name}" loaded into Bulk Send.`);
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
        Loading emails...
      </div>
    );
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px",
    background: active ? "#1e40af" : "#e2e8f0",
    color: active ? "#fff" : "#0f172a",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  });

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    fontSize: 14,
    boxSizing: "border-box",
  };

  const btnStyle = (bg: string, fg: string, border?: string): React.CSSProperties => ({
    padding: "6px 12px",
    background: bg,
    color: fg,
    border: border ? `1px solid ${border}` : "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  });

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 24 }}>
        ✉️ Email Outreach
      </h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <button
          onClick={() => router.push("/emails/compose")}
          style={{
            ...tabStyle(true),
            background: "#16a34a",
          }}
        >
          ✏️ Compose Email
        </button>
        <button onClick={() => setActiveTab("bulk")} style={tabStyle(activeTab === "bulk")}>
          📦 Bulk Send
        </button>
        <button onClick={() => setActiveTab("templates")} style={tabStyle(activeTab === "templates")}>
          🗂 Templates ({templates.length})
        </button>
        <button onClick={() => setActiveTab("sent")} style={tabStyle(activeTab === "sent")}>
          📨 Sent History ({logs.length})
        </button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", color: "#dc2626", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}
      {notice && (
        <div style={{ background: "#dcfce7", color: "#166534", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          {notice}
        </div>
      )}

      {activeTab === "bulk" && (
        <div>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
              📦 Bulk Send — {finalTargets.length} of {companyTargets.length} companies selected
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              <code>[Company Name]</code> is replaced from the database for each recipient. Edit{" "}
              <code>[Your Name]</code>, <code>[Phone]</code>, and <code>[Email]</code> in the fields below or directly in the body.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 8 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Your Name</label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Juan Dela Cruz"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 917 000 0000"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Email</label>
              <input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="you@coldprime.ph"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              style={btnStyle(savingProfile ? "#94a3b8" : "#fff", "#1e40af", "#1e40af")}
            >
              {savingProfile ? "Saving…" : "💾 Save details"}
            </button>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              Saved once — prefilled automatically next time on any device.
            </span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Subject</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={18}
              style={{ ...inputStyle, fontFamily: "monospace", lineHeight: 1.5 }}
            />
          </div>

          <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 16, background: "#fff" }}>
            <div
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                Recipients — {finalTargets.length} will receive
                {limitNum > 0 && selectedIds.length > finalTargets.length ? ` (limited to ${limitNum})` : ""}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button
                  onClick={() => setSelectedIds(filteredCompanies.map((c) => c.id!))}
                  style={btnStyle("#f1f5f9", "#0f172a", "#e2e8f0")}
                >
                  Select all shown
                </button>
                <button onClick={() => setSelectedIds([])} style={btnStyle("#f1f5f9", "#0f172a", "#e2e8f0")}>
                  Deselect all
                </button>
                <label style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                  Max sends:
                  <input
                    type="number"
                    min={1}
                    value={sendLimit}
                    onChange={(e) => setSendLimit(e.target.value)}
                    placeholder="∞"
                    style={{
                      width: 70,
                      padding: "4px 8px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  />
                </label>
              </div>
            </div>
            <div style={{ padding: "8px 12px" }}>
              <input
                type="text"
                value={recipSearch}
                onChange={(e) => setRecipSearch(e.target.value)}
                placeholder="Search companies by name or email..."
                style={inputStyle}
              />
            </div>
            <div style={{ maxHeight: 280, overflow: "auto", padding: "0 12px 12px" }}>
              {filteredCompanies.length === 0 && (
                <div style={{ fontSize: 13, color: "#94a3b8", padding: "8px 0" }}>
                  No companies with email addresses found.
                </div>
              )}
              {filteredCompanies.map((c) => (
                <label
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 4px",
                    fontSize: 13,
                    borderBottom: "1px solid #f1f5f9",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(c.id!)}
                    onChange={() => toggleSelect(c.id!)}
                    disabled={sending}
                  />
                  <span style={{ fontWeight: 500, minWidth: 180 }}>{c.name}</span>
                  <span style={{ color: "#64748b", fontSize: 12 }}>{c.email}</span>
                </label>
              ))}
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 16, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={skipAlreadySent}
              onChange={(e) => setSkipAlreadySent(e.target.checked)}
              disabled={sending}
            />
            Skip companies that already received an email with this subject
          </label>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={handleBulkSend}
              disabled={sending || finalTargets.length === 0}
              style={{
                padding: "10px 24px",
                background: sending ? "#94a3b8" : "#1e40af",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: sending ? "not-allowed" : "pointer",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {sending && progress
                ? `Sending ${progress.done}/${progress.total}…`
                : `Send to ${finalTargets.length} Companies`}
            </button>
            <button
              onClick={() => { setShowSaveForm((v) => !v); setError(""); setNotice(""); }}
              disabled={sending}
              style={{
                padding: "10px 16px",
                background: "#fff",
                color: "#1e40af",
                border: "1px solid #1e40af",
                borderRadius: 6,
                cursor: sending ? "not-allowed" : "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {showSaveForm ? "Close" : "Save as Template"}
            </button>
          </div>

          {showSaveForm && (
            <div
              style={{
                marginTop: 12,
                padding: 16,
                border: "1px solid #bfdbfe",
                background: "#eff6ff",
                borderRadius: 8,
              }}
            >
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                Template name
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveTemplate(); }}
                  placeholder="Vendor Accreditation"
                  style={{ ...inputStyle, flex: 1 }}
                  autoFocus
                />
                <button
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate}
                  style={{
                    padding: "8px 16px",
                    background: savingTemplate ? "#94a3b8" : "#16a34a",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    cursor: savingTemplate ? "not-allowed" : "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {savingTemplate ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}

          {result && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 8,
                background: result.failed > 0 ? "#fffbeb" : "#dcfce7",
                color: result.failed > 0 ? "#92400e" : "#166534",
                fontSize: 14,
              }}
            >
              Done — {result.sent} sent, {result.failed} failed, {result.skipped} skipped.
            </div>
          )}
        </div>
      )}

      {activeTab === "templates" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Templates ({templates.length})</h2>
            <button
              onClick={() => router.push("/emails/compose")}
              style={{ ...tabStyle(true), background: "#16a34a" }}
            >
              ✏️ Compose New Email
            </button>
          </div>
          {templates.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>No templates yet. Save one from the Bulk Send tab.</p>
          ) : (
            templates.map((tpl) => (
              <div
                key={tpl.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  marginBottom: 10,
                  background: "#fff",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{tpl.name}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{tpl.subject}</div>
                      <span
                        style={{
                          fontSize: 11,
                          background: tpl.category === "HVAC" ? "#dbeafe" : tpl.category === "IAQ" ? "#dcfce7" : "#fef3c7",
                          padding: "2px 8px",
                          borderRadius: 4,
                          marginTop: 4,
                          display: "inline-block",
                        }}
                      >
                        {tpl.category || "General"}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    <button onClick={() => setExpandedId(expandedId === tpl.id ? null : tpl.id)} style={btnStyle("#f1f5f9", "#0f172a", "#e2e8f0")}>
                      {expandedId === tpl.id ? "Hide body" : "Preview"}
                    </button>
                    <button
                      onClick={() => router.push(`/emails/compose?template=${encodeURIComponent(tpl.id)}`)}
                      style={btnStyle("#16a34a", "#fff")}
                    >
                      Compose
                    </button>
                    <button onClick={() => loadIntoBulk(tpl)} style={btnStyle("#1e40af", "#fff")}>
                      Use in Bulk Send
                    </button>
                    <button onClick={() => (editingId === tpl.id ? setEditingId(null) : startEdit(tpl))} style={btnStyle("#fff", "#1e40af", "#1e40af")}>
                      {editingId === tpl.id ? "Cancel edit" : "Edit"}
                    </button>
                    <button onClick={() => handleDeleteTemplate(tpl)} style={btnStyle("#fef2f2", "#dc2626", "#fecaca")}>
                      Delete
                    </button>
                  </div>

                  {expandedId === tpl.id && (
                    <pre
                      style={{
                        marginTop: 10,
                        padding: 12,
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: 6,
                        fontSize: 12,
                        whiteSpace: "pre-wrap",
                        fontFamily: "monospace",
                        maxHeight: 240,
                        overflow: "auto",
                        lineHeight: 1.5,
                      }}
                    >
                      {tpl.body || "(empty)"}
                    </pre>
                  )}
                </div>

                {editingId === tpl.id && (
                  <div style={{ padding: 12, borderTop: "1px solid #e2e8f0", background: "#eff6ff" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: 8, marginBottom: 8 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Name</label>
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Subject</label>
                        <input type="text" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Category</label>
                        <input type="text" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Body</label>
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={12}
                        style={{ ...inputStyle, fontFamily: "monospace", lineHeight: 1.5 }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={handleUpdateTemplate}
                        disabled={savingEdit}
                        style={btnStyle(savingEdit ? "#94a3b8" : "#16a34a", "#fff")}
                      >
                        {savingEdit ? "Saving…" : "Save changes"}
                      </button>
                      <button onClick={() => setEditingId(null)} style={btnStyle("#fff", "#64748b", "#e2e8f0")}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          <div style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Single Recipients</h2>
            <div style={{ maxHeight: 400, overflow: "auto" }}>
              {recipients.map((r, i) => (
                <div
                  key={i}
                  onClick={() =>
                    router.push(
                      `/emails/compose?to=${encodeURIComponent(r.email)}&toName=${encodeURIComponent(r.name || "")}`
                    )
                  }
                  style={{
                    padding: 10,
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    marginBottom: 6,
                    cursor: "pointer",
                    background: "#fff",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                >
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{r.name || r.email}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{r.email}</div>
                  {r.industry && <div style={{ fontSize: 10, color: "#94a3b8" }}>{r.industry}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "sent" && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Sent Emails ({logs.length})</h2>
          {logs.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>No emails sent yet. Compose one to get started.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {logs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: 16,
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    background: log.status === "FAILED" ? "#fef2f2" : "#fff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{log.subject}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        To: {log.toName || log.toEmail} &bull; {new Date(log.sentAt).toLocaleString()}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: log.status === "SENT" ? "#dcfce7" : "#fef2f2",
                        color: log.status === "SENT" ? "#166534" : "#dc2626",
                        fontWeight: 600,
                      }}
                    >
                      {log.status}
                    </span>
                  </div>
                  {log.errorCode && (
                    <div style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>Error: {log.errorCode}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
