"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { EmailTemplate as Template, Recipient, EmailLog, MailSummary, MailViewState } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui";

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

interface EmailStatus {
  senderEmail: string | null;
  freeMailWarning: string | null;
  dailyCap: number;
  sentToday: number;
  remaining: number;
}

export default function EmailsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [activeTab, setActiveTab] = useState<"bulk" | "templates" | "sent" | "mailbox">("bulk");
  const [loading, setLoading] = useState(true);

  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [senderName, setSenderName] = useState("");
  const [phone, setPhone] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [cc, setCc] = useState("");
  const [ccName, setCcName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [skipAlreadySent, setSkipAlreadySent] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendConfirm, setSendConfirm] = useState<{ count: number; ccNote: string } | null>(null);
  const [tplDelete, setTplDelete] = useState<Template | null>(null);
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
  const [checkingReplies, setCheckingReplies] = useState(false);
  const [mailboxFolder, setMailboxFolder] = useState<"inbox" | "sent">("inbox");
  const [mailList, setMailList] = useState<MailSummary[] | null>(null);
  const [mailListLoading, setMailListLoading] = useState(false);
  const [mailListError, setMailListError] = useState("");
  const [mailFilter, setMailFilter] = useState<"all" | "replies">("all");
  const [openMail, setOpenMail] = useState<MailViewState | null>(null);
  const [viewLog, setViewLog] = useState<MailViewState | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [delLog, setDelLog] = useState<EmailLog | null>(null);
  const [deletingLog, setDeletingLog] = useState(false);

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
      fetch("/api/emails/status").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([tplRes, recRes, logRes, statusRes]) => {
        setTemplates(tplRes.data || []);
        if (statusRes && !statusRes.error) setEmailStatus(statusRes);
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

  const fetchMailList = async (folder: "inbox" | "sent") => {
    setMailListLoading(true);
    setMailListError("");
    setOpenMail(null);
    try {
      const res = await fetch(`/api/emails/mailbox?folder=${folder}&days=30&limit=100`);
      const data = await res.json();
      if (res.ok) {
        setMailList(data.data || []);
      } else {
        setMailList(null);
        setMailListError(res.status === 403
          ? "Inbox and Sent are restricted to admin accounts (shared mailbox). Your Sent History tab still shows everything the CRM sent."
          : data.error || "Failed to load mailbox");
      }
    } catch {
      setMailList(null);
      setMailListError("Failed to load mailbox");
    } finally {
      setMailListLoading(false);
    }
  };

  const openMailboxTab = () => {
    setActiveTab("mailbox");
    fetchMailList(mailboxFolder);
  };

  const switchFolder = (folder: "inbox" | "sent") => {
    setMailboxFolder(folder);
    fetchMailList(folder);
  };

  const toggleMail = async (m: MailSummary) => {
    const key = `${mailboxFolder}-${m.uid}`;
    if (openMail?.key === key) {
      setOpenMail(null);
      return;
    }
    setOpenMail({ key, loading: true, data: null, error: "" });
    try {
      const res = await fetch(`/api/emails/mailbox?folder=${mailboxFolder}&uid=${m.uid}`);
      const data = await res.json();
      if (res.ok) setOpenMail({ key, loading: false, data: data.data, error: "" });
      else setOpenMail({ key, loading: false, data: null, error: data.error || "Failed to load message" });
    } catch {
      setOpenMail({ key, loading: false, data: null, error: "Failed to load message" });
    }
  };

  const viewSentLog = async (log: EmailLog) => {
    if (viewLog?.key === log.id) {
      setViewLog(null);
      return;
    }
    setViewLog({ key: log.id, loading: true, data: null, error: "" });
    try {
      const res = await fetch(`/api/emails/mailbox?logId=${encodeURIComponent(log.id)}`);
      const data = await res.json();
      if (res.ok) setViewLog({ key: log.id, loading: false, data: data.data, error: "" });
      else setViewLog({ key: log.id, loading: false, data: null, error: data.error || "Failed to load message" });
    } catch {
      setViewLog({ key: log.id, loading: false, data: null, error: "Failed to load message" });
    }
  };

  const loadLogs = async (deleted: boolean) => {
    try {
      const res = await fetch(`/api/emails/logs${deleted ? "?deleted=true" : ""}`);
      const data = await res.json();
      if (res.ok) setLogs(data.data || []);
      else setError(data.error || "Failed to load sent history");
    } catch {
      setError("Failed to load sent history");
    }
  };

  const toggleShowDeleted = () => {
    const next = !showDeleted;
    setShowDeleted(next);
    loadLogs(next);
  };

  const handleOptOut = async (log: EmailLog) => {
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/emails/opt-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: log.toEmail }),
      });
      const data = await res.json();
      if (res.ok) setNotice(`Marked ${log.toEmail} as opted out. No further emails will be sent to this address.`);
      else setError(data.error || "Failed to mark as opted out");
    } catch {
      setError("Failed to mark as opted out");
    }
  };

  const handleDeleteLog = async () => {
    if (!delLog) return;
    setDeletingLog(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(
        `/api/emails/${encodeURIComponent(delLog.id)}${showDeleted ? "?purge=true" : ""}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (res.ok) {
        setNotice(showDeleted ? `Purged "${delLog.subject}".` : `Deleted "${delLog.subject}" from Sent History (kept for audit).`);
        setDelLog(null);
        await loadLogs(showDeleted);
      } else {
        setError(data.error || "Failed to delete email");
      }
    } catch {
      setError("Failed to delete email");
    } finally {
      setDeletingLog(false);
    }
  };

  const handleCheckReplies = async () => {
    setCheckingReplies(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/emails/check-replies", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setNotice(
          `Checked ${data.checked} inbox messages — ${data.repliesFound} replies matched${data.companies?.length ? `: ${data.companies.join(", ")}` : ""}. Companies updated to REPLIED.`
        );
        if (activeTab === "mailbox") fetchMailList(mailboxFolder);
      } else {
        setError(data.error || "Reply check failed");
      }
    } catch {
      setError("Reply check failed");
    } finally {
      setCheckingReplies(false);
    }
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

  const requestBulkSend = () => {
    if (!subject.trim() || !body.trim()) {
      setError("Subject and body are required");
      return;
    }
    if (finalTargets.length === 0) {
      setError("Select at least one company to send to");
      return;
    }
    const ccNote = cc.trim() ? ` The CC address (${cc}) will receive a copy of EVERY email sent (${finalTargets.length} copies).` : "";
    setSendConfirm({ count: finalTargets.length, ccNote });
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
          body: JSON.stringify({ subject, body: finalBody, companyIds: chunk, skipAlreadySent, senderName, cc: cc.trim() || undefined, ccName: ccName.trim() || undefined }),
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
        setTemplates((prev) => [data, ...prev]);
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

  const requestDeleteTemplate = (tpl: Template) => setTplDelete(tpl);

  const handleDeleteTemplate = async () => {
    const tpl = tplDelete;
    if (!tpl) return;
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/emails/templates/${encodeURIComponent(tpl.id)}`, { method: "DELETE" });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
        setNotice(`Template "${tpl.name}" deleted.`);
        if (editingId === tpl.id) setEditingId(null);
        setTplDelete(null);
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
      <div className="page">
        <p className="text-center text-slate-400">Loading emails...</p>
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
    <div className="page max-w-[900px] mx-auto my-0">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        ✉️ Email Outreach
      </h1>

      <div className="flex gap-2 mb-6 flex-wrap">
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
        <button onClick={openMailboxTab} style={tabStyle(activeTab === "mailbox")}>
          📬 Mailbox
        </button>
        <button onClick={() => setActiveTab("sent")} style={tabStyle(activeTab === "sent")}>
          📨 Sent History ({logs.length})
        </button>
        <button onClick={handleCheckReplies} disabled={checkingReplies} style={tabStyle(false)}>
          {checkingReplies ? "Checking…" : "🔄 Check replies"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 mb-4 p-3 rounded-lg">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-green-100 text-green-800 mb-4 p-3 rounded-lg">
          {notice}
        </div>
      )}

      {emailStatus?.freeMailWarning && (
        <div className="bg-amber-50 text-amber-800 mb-4 border border-yellow-200 text-[13px] p-3 rounded-lg">
          ⚠️ {emailStatus.freeMailWarning}
        </div>
      )}

      <details className="bg-slate-50 border border-slate-200 px-3.5 py-2.5 mb-4 text-[13px] rounded-lg">
        <summary className="cursor-pointer font-semibold">
          📋 Sending setup checklist (owner action)
          {emailStatus ? ` — today: ${emailStatus.sentToday}/${emailStatus.dailyCap} sent, ${emailStatus.remaining} remaining` : ""}
        </summary>
        <ul className="text-slate-600 leading-[1.7] mr-[18px] mb-0 ml-0 mt-2">
          <li>Send from an address on the company&apos;s own domain (confirm: <code>coldprimecorporation.com</code> for email vs <code>coldprimecorp.com</code> for the website).</li>
          <li>Configure SPF, DKIM and DMARC records for that domain before sending volume.</li>
          <li>Warm the address up gradually — the daily cap per user is enforced in code (default 30, set <code>EMAIL_DAILY_CAP</code> to change).</li>
          <li>The company profile PDF (~44 MB) exceeds Gmail&apos;s 25 MB limit — compress it or share it as a link.</li>
        </ul>
      </details>

      <div className="page-scroll">
      {activeTab === "bulk" && (
        <div>
          <div className="bg-slate-50 border border-slate-200 mb-4 rounded-lg p-4">
            <div className="font-semibold text-sm mb-1">
              📦 Bulk Send — {finalTargets.length} of {companyTargets.length} companies selected
            </div>
            <div className="text-xs text-slate-500">
              <code>[Company Name]</code> is replaced from the database for each recipient. Edit{" "}
              <code>[Your Name]</code>, <code>[Phone]</code>, and <code>[Email]</code> in the fields below or directly in the body.
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-2">
            <div>
              <label className="block text-[13px] font-semibold mb-1">Your Name</label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Juan Dela Cruz"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 917 000 0000"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-1">Email</label>
              <input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="you@coldprime.ph"
                style={inputStyle}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <label className="block text-[13px] font-semibold mb-1">
                CC <span className="font-normal text-slate-400 text-[11px]">(optional — gets a copy of every send)</span>
              </label>
              <input
                type="email"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="archived@coldprime.ph"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-1">CC Name</label>
              <input
                type="text"
                value={ccName}
                onChange={(e) => setCcName(e.target.value)}
                placeholder="Coldprime Archive"
                style={inputStyle}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              style={btnStyle(savingProfile ? "#94a3b8" : "#fff", "#1e40af", "#1e40af")}
            >
              {savingProfile ? "Saving…" : "💾 Save details"}
            </button>
            <span className="text-[11px] text-slate-400">
              Saved once — prefilled automatically next time on any device.
            </span>
          </div>

          <div className="mb-4">
            <label className="block text-[13px] font-semibold mb-1">Subject</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
          </div>

          <div className="mb-4">
            <label className="block text-[13px] font-semibold mb-1">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={18}
              style={{ ...inputStyle, fontFamily: "monospace", lineHeight: 1.5 }}
            />
          </div>

          <div className="border border-slate-200 mb-4 bg-white rounded-lg">
            <div className="px-3 py-2.5 border-b border-b-slate-200 flex justify-between items-center flex-wrap gap-2"
            >
              <div className="text-[13px] font-semibold">
                Recipients — {finalTargets.length} will receive
                {limitNum > 0 && selectedIds.length > finalTargets.length ? ` (limited to ${limitNum})` : ""}
              </div>
              <div className="flex gap-1.5 items-center">
                <button
                  onClick={() => setSelectedIds(filteredCompanies.map((c) => c.id!))}
                  style={btnStyle("#f1f5f9", "#0f172a", "#e2e8f0")}
                >
                  Select all shown
                </button>
                <button onClick={() => setSelectedIds([])} style={btnStyle("#f1f5f9", "#0f172a", "#e2e8f0")}>
                  Deselect all
                </button>
                <label className="text-xs text-slate-500 flex items-center gap-1">
                  Max sends:
                  <input
                    type="number"
                    min={1}
                    value={sendLimit}
                    onChange={(e) => setSendLimit(e.target.value)}
                    placeholder="∞" className="px-2 py-1 border border-slate-200 text-[13px] w-[70px] rounded-md"
                  />
                </label>
              </div>
            </div>
            <div className="px-3 py-2">
              <input
                type="text"
                value={recipSearch}
                onChange={(e) => setRecipSearch(e.target.value)}
                placeholder="Search companies by name or email..."
                style={inputStyle}
              />
            </div>
            <div className="overflow-auto max-h-[280px] pb-3 px-3 pt-0">
              {filteredCompanies.length === 0 && (
                <div className="text-[13px] text-slate-400 px-0 py-2">
                  No companies with email addresses found.
                </div>
              )}
              {filteredCompanies.map((c) => (
                <label
                  key={c.id} className="flex items-center gap-2 px-1 py-1.5 text-[13px] border-b border-b-slate-100 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(c.id!)}
                    onChange={() => toggleSelect(c.id!)}
                    disabled={sending}
                  />
                  <span className="font-medium min-w-[180px]">{c.name}</span>
                  <span className="text-slate-500 text-xs">{c.email}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-[13px] mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={skipAlreadySent}
              onChange={(e) => setSkipAlreadySent(e.target.checked)}
              disabled={sending}
            />
            Skip companies that already received an email with this subject
          </label>

          <div className="flex gap-2 items-center">
            <button
              onClick={requestBulkSend}
              disabled={sending || finalTargets.length === 0} className={`${`${`px-6 py-2.5 text-white text-sm font-bold ${sending ? "bg-slate-400 cursor-not-allowed" : "bg-blue-800 cursor-pointer"}`} border-0`} rounded-md`}
            >
              {sending && progress
                ? `Sending ${progress.done}/${progress.total}…`
                : `Send to ${finalTargets.length} Companies`}
            </button>
            <button
              onClick={() => { setShowSaveForm((v) => !v); setError(""); setNotice(""); }}
              disabled={sending} className={`${`px-4 py-2.5 bg-white text-blue-800 border border-blue-800 text-sm font-semibold ${sending ? "cursor-not-allowed" : "cursor-pointer"}`} rounded-md`}
            >
              {showSaveForm ? "Close" : "Save as Template"}
            </button>
          </div>

          {showSaveForm && (
            <div className="mt-3 border border-blue-200 bg-[#eff6ff] p-4 rounded-lg"
            >
              <label className="block text-[13px] font-semibold mb-1">
                Template name
              </label>
              <div className="flex gap-2">
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
                  disabled={savingTemplate} className={`${`${`px-4 py-2 text-white text-sm font-semibold ${savingTemplate ? "bg-slate-400 cursor-not-allowed" : "bg-green-600 cursor-pointer"}`} border-0`} rounded-md`}
                >
                  {savingTemplate ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className={`${`mt-4 text-sm ${result.failed > 0 ? "bg-amber-50 text-amber-800" : "bg-green-100 text-green-800"}`} p-4 rounded-lg`}
            >
              Done — {result.sent} sent, {result.failed} failed, {result.skipped} skipped.
            </div>
          )}
        </div>
      )}

      {activeTab === "templates" && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-semibold">Templates ({templates.length})</h2>
            <button
              onClick={() => router.push("/emails/compose")}
              style={{ ...tabStyle(true), background: "#16a34a" }}
            >
              ✏️ Compose New Email
            </button>
          </div>
          {templates.length === 0 ? (
            <p className="text-slate-400 text-sm">No templates yet. Save one from the Bulk Send tab.</p>
          ) : (
            templates.map((tpl) => (
              <div
                key={tpl.id} className="border border-slate-200 mb-2.5 bg-white overflow-hidden rounded-lg"
              >
                <div className="p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{tpl.name}</div>
                      <div className="text-xs text-slate-500">{tpl.subject}</div>
                      <span className={`text-[11px] px-2 py-0.5 mt-1 inline-block rounded ${tpl.category === "HVAC" ? "bg-blue-100" : tpl.category === "IAQ" ? "bg-green-100" : "bg-amber-100"}`}
                      >
                        {tpl.category || "General"}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-1.5 mt-2.5 flex-wrap">
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
                    <button onClick={() => requestDeleteTemplate(tpl)} style={btnStyle("#fef2f2", "#dc2626", "#fecaca")}>
                      Delete
                    </button>
                  </div>

                  {expandedId === tpl.id && (
                    <pre className="mt-2.5 bg-slate-50 border border-slate-200 text-xs whitespace-pre-wrap overflow-auto leading-normal p-3 rounded-md max-h-[240px] font-mono"
                    >
                      {tpl.body || "(empty)"}
                    </pre>
                  )}
                </div>

                {editingId === tpl.id && (
                  <div className="border-t border-t-slate-200 bg-[#eff6ff] p-3">
                    <div className="grid grid-cols-[1fr_1fr_140px] gap-2 mb-2">
                      <div>
                        <label className="block text-xs font-semibold mb-0.5">Name</label>
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-0.5">Subject</label>
                        <input type="text" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-0.5">Category</label>
                        <input type="text" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={inputStyle} />
                      </div>
                    </div>
                    <div className="mb-2">
                      <label className="block text-xs font-semibold mb-0.5">Body</label>
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={12}
                        style={{ ...inputStyle, fontFamily: "monospace", lineHeight: 1.5 }}
                      />
                    </div>
                    <div className="flex gap-2">
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

          <div className="mt-6">
            <h2 className="text-base font-semibold mb-3">Single Recipients</h2>
            <div className="overflow-auto max-h-[400px]">
              {recipients.map((r, i) => (
                <div
                  key={i}
                  onClick={() =>
                    router.push(
                      `/emails/compose?to=${encodeURIComponent(r.email)}&toName=${encodeURIComponent(r.name || "")}`
                    )
                  } className="border border-slate-200 mb-1.5 cursor-pointer bg-white p-2.5 rounded-lg"
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                >
                  <div className="font-medium text-[13px]">{r.name || r.email}</div>
                  <div className="text-[11px] text-slate-500">{r.email}</div>
                  {r.industry && <div className="text-[10px] text-slate-400">{r.industry}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "mailbox" && (
        <div>
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <div className="flex gap-1.5 items-center">
              <button
                onClick={() => switchFolder("inbox")}
                style={btnStyle(mailboxFolder === "inbox" ? "#1e40af" : "#f1f5f9", mailboxFolder === "inbox" ? "#fff" : "#0f172a", mailboxFolder === "inbox" ? undefined : "#e2e8f0")}
              >
                📥 Inbox
              </button>
              <button
                onClick={() => switchFolder("sent")}
                style={btnStyle(mailboxFolder === "sent" ? "#1e40af" : "#f1f5f9", mailboxFolder === "sent" ? "#fff" : "#0f172a", mailboxFolder === "sent" ? undefined : "#e2e8f0")}
              >
                📤 Sent
              </button>
              <select
                value={mailFilter}
                onChange={(e) => setMailFilter(e.target.value as "all" | "replies")} className="px-2 py-[5px] border border-slate-200 text-xs rounded-md"
              >
                <option value="all">All messages</option>
                <option value="replies">{mailboxFolder === "inbox" ? "Replies only" : "CRM sends only"}</option>
              </select>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => fetchMailList(mailboxFolder)} disabled={mailListLoading} style={btnStyle("#f1f5f9", "#0f172a", "#e2e8f0")}>
                {mailListLoading ? "Loading…" : "🔄 Refresh"}
              </button>
              <button onClick={handleCheckReplies} disabled={checkingReplies} style={btnStyle("#1e40af", "#fff")}>
                {checkingReplies ? "Checking…" : "✅ Check replies (update statuses)"}
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-400 mb-3">
            Last 30 days — click a message to read it. Green = reply to your outreach; blue badge in Sent = sent by the CRM.
          </div>

          {mailListLoading && !mailList && (
            <div className="text-center text-slate-400 p-8">Loading mailbox…</div>
          )}
          {mailListError && (
            <div className="bg-red-50 text-red-600 mb-3 p-3 rounded-lg">
              {mailListError}
            </div>
          )}
          {mailList &&
            (() => {
              const shown = mailFilter === "replies" ? mailList.filter((m) => m.matched) : mailList;
              if (shown.length === 0) {
                return <p className="text-slate-400 text-sm">No messages{mailFilter === "replies" ? " matched" : ""} in the last 30 days.</p>;
              }
              return (
                <div className="flex flex-col gap-1.5">
                  {shown.map((m) => {
                    const key = `${mailboxFolder}-${m.uid}`;
                    const isOpen = openMail?.key === key;
                    return (
                      <div key={m.uid} className={`${`border border-slate-200 overflow-hidden ${m.matched ? "bg-green-50" : "bg-white"}`} rounded-lg`}>
                        <div
                          onClick={() => toggleMail(m)} className="px-3.5 py-2.5 cursor-pointer flex justify-between gap-2 items-center"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-[13px] whitespace-nowrap overflow-hidden text-ellipsis">{m.subject}</div>
                            <div className="text-xs text-slate-500">
                              {mailboxFolder === "inbox" ? `From: ${m.from}` : `To: ${m.to}`}
                              {m.date ? ` • ${new Date(m.date).toLocaleString()}` : ""}
                            </div>
                          </div>
                          <div className="flex gap-1.5 shrink-0 items-center">
                            {m.matched && (
                              <span className={`${`text-[11px] font-semibold px-2 py-0.5 ${mailboxFolder === "inbox" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`} rounded`}
                              >
                                {mailboxFolder === "inbox" ? "↩ Reply" : "CRM send"}
                                {m.company ? ` • ${m.company.name}` : ""}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400">{isOpen ? "▾" : "▸"}</span>
                          </div>
                        </div>
                        {isOpen && (
                          <div className="border-t border-t-slate-200 p-3">
                            {openMail?.loading ? (
                              <div className="text-center text-slate-400 p-6">Loading message…</div>
                            ) : openMail?.error ? (
                              <div className="text-red-600 text-[13px] p-2">{openMail.error}</div>
                            ) : openMail?.data ? (
                              <div>
                                <div className="text-xs text-slate-500 mb-2">
                                  From: {openMail.data.from} • To: {openMail.data.to}
                                  {openMail.data.cc ? ` • CC: ${openMail.data.cc}` : ""}
                                </div>
                                {openMail.data.html ? (
                                  <iframe
                                    srcDoc={openMail.data.html}
                                    sandbox="" className="w-full border border-slate-200 bg-white h-[480px] rounded-md"
                                  />
                                ) : (
                                  <pre className="whitespace-pre-wrap text-[13px] bg-slate-50 p-3 rounded-md font-mono">
                                    {openMail.data.text || "(empty)"}
                                  </pre>
                                )}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
        </div>
      )}

      {activeTab === "sent" && (
        <div>
          <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
            <h2 className="text-base font-semibold">
              {showDeleted ? "Deleted Emails" : "Sent Emails"} ({logs.length})
            </h2>
            <button onClick={toggleShowDeleted} style={btnStyle(showDeleted ? "#1e40af" : "#f1f5f9", showDeleted ? "#fff" : "#1e40af", "#e2e8f0")}>
              {showDeleted ? "↩ Back to sent history" : "🗑 Deleted emails"}
            </button>
          </div>
          {logs.length === 0 ? (
            <p className="text-slate-400 text-sm">
              {showDeleted ? "No deleted emails." : "No emails sent yet. Compose one to get started."}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {logs.map((log) => (
                <div
                  key={log.id} className={`${`border border-slate-200 ${log.status === "FAILED" ? "bg-red-50" : "bg-white"}`} p-4 rounded-lg`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-sm">{log.subject}</div>
                      <div className="text-xs text-slate-500">
                        To: {log.toName || log.toEmail} &bull; {new Date(log.sentAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <span className={`${`text-[11px] px-2 py-0.5 font-semibold ${log.status === "SENT" ? "bg-green-100 text-green-800" : "bg-red-50 text-red-600"}`} rounded`}
                      >
                        {log.status}
                      </span>
                      {log.status === "SENT" && !showDeleted && (
                        <button onClick={() => viewSentLog(log)} style={btnStyle("#f1f5f9", "#1e40af", "#e2e8f0")}>
                          {viewLog?.key === log.id && viewLog.loading ? "Loading…" : viewLog?.key === log.id && viewLog.data ? "Hide" : "👁 View"}
                        </button>
                      )}
                      {!showDeleted && (
                        <button onClick={() => handleOptOut(log)} title={`Mark ${log.toEmail} as opted out`} style={btnStyle("#fff7ed", "#c2410c", "#fed7aa")}>
                          🚫 Opt out
                        </button>
                      )}
                      <button onClick={() => setDelLog(log)} style={btnStyle("#fef2f2", "#dc2626", "#fecaca")}>
                        {showDeleted ? "🔥 Purge" : "🗑 Delete"}
                      </button>
                    </div>
                  </div>
                  {log.errorCode && (
                    <div className="text-xs text-red-600 mt-2">Error: {log.errorCode}</div>
                  )}
                  {viewLog?.key === log.id && (
                    <div className="mt-2.5">
                      {viewLog.loading ? (
                        <div className="text-center text-slate-400 p-4">Loading message…</div>
                      ) : viewLog.error ? (
                        <div className="text-red-600 text-[13px]">{viewLog.error}</div>
                      ) : viewLog.data ? (
                        viewLog.data.html ? (
                          <iframe
                            srcDoc={viewLog.data.html}
                            sandbox="" className="w-full border border-slate-200 bg-white h-[480px] rounded-md"
                          />
                        ) : (
                          <pre className="whitespace-pre-wrap text-[13px] bg-slate-50 p-3 rounded-md font-mono">
                            {viewLog.data.text || "(empty)"}
                          </pre>
                        )
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>

      <ConfirmDialog
        open={sendConfirm !== null}
        title="Confirm bulk send"
        message={`Send this email to ${sendConfirm?.count ?? 0} companies?${sendConfirm?.ccNote || ""} This cannot be undone.`}
        confirmLabel="Send"
        danger={false}
        busy={sending}
        onCancel={() => setSendConfirm(null)}
        onConfirm={async () => {
          setSendConfirm(null);
          await handleBulkSend();
        }}
      />

      <ConfirmDialog
        open={tplDelete !== null}
        title="Delete template"
        message={`Delete template "${tplDelete?.name}"? This cannot be undone.`}
        onCancel={() => setTplDelete(null)}
        onConfirm={handleDeleteTemplate}
      />

      <ConfirmDialog
        open={delLog !== null}
        title={showDeleted ? "Purge email permanently" : "Delete email"}
        message={
          showDeleted
            ? `Permanently purge "${delLog?.subject}"? The row is removed from the database entirely.`
            : `Delete "${delLog?.subject}" from Sent History? It is hidden from the UI but kept for audit and opt-out history.`
        }
        confirmLabel={showDeleted ? "Purge" : "Delete"}
        danger
        busy={deletingLog}
        onCancel={() => setDelLog(null)}
        onConfirm={handleDeleteLog}
      />
    </div>
  );
}
