"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailTemplate as Template } from "@/lib/types";

function ComposeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [toEmail, setToEmail] = useState("");
  const [toName, setToName] = useState("");
  const [cc, setCc] = useState("");
  const [ccName, setCcName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [senderStatus, setSenderStatus] = useState<{ freeMailWarning: string | null; sentToday: number; dailyCap: number; remaining: number } | null>(null);
  const [paramsApplied, setParamsApplied] = useState(false);

  useEffect(() => {
    fetch("/api/emails/templates")
      .then((r) => r.json())
      .then((res) => setTemplates(res.data || []))
      .catch(console.error);
    fetch("/api/emails/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => { if (res && !res.error) setSenderStatus(res); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (paramsApplied) return;
    const templateId = searchParams.get("template");
    const to = searchParams.get("to");
    const name = searchParams.get("toName");
    if (to) setToEmail(to);
    if (name) setToName(name);
    if (templateId) {
      // Wait until templates have loaded before applying the param
      if (templates.length === 0) return;
      const tpl = templates.find((t) => t.id === templateId);
      if (tpl) {
        setSelectedTemplate(tpl);
        setSubject(tpl.subject);
        setBody(tpl.body);
      }
    }
    if (templateId || to || name) setParamsApplied(true);
  }, [searchParams, templates, paramsApplied]);

  const handleSend = useCallback(async () => {
    if (!toEmail || !body) {
      setError("Recipient email and body are required");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail,
          toName,
          subject,
          body,
          templateId: selectedTemplate?.id,
          cc: cc || undefined,
          ccName: ccName || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setWarnings(data.warnings || []);
        setSent(true);
        setToEmail("");
        setToName("");
        setCc("");
        setCcName("");
        setSubject("");
        setBody("");
        setSelectedTemplate(null);
      } else {
        setError(data.error || "Failed to send");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }, [toEmail, toName, cc, ccName, subject, body, selectedTemplate]);

  if (sent) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16, color: "#22c55e" }}>✅</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>Email Sent Successfully!</h2>
        {warnings.length > 0 && (
          <div style={{ maxWidth: 640, margin: "16px auto 0", background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", padding: 12, borderRadius: 8, textAlign: "left", fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Sent, but {warnings.length} deliverability warning{warnings.length > 1 ? "s" : ""}:</div>
            <ul style={{ margin: "0 0 0 18px", lineHeight: 1.6 }}>
              {warnings.map((w, i) => (<li key={i}>{w}</li>))}
            </ul>
          </div>
        )}
        <button
          onClick={() => router.push("/emails")}
          style={{
            marginTop: 16,
            padding: "10px 24px",
            background: "#1e40af",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Back to Emails
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 24 }}>
        ✉️ Compose Email
      </h1>

      {error && (
        <div style={{ background: "#fef2f2", color: "#dc2626", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {senderStatus?.freeMailWarning && (
        <div style={{ background: "#fffbeb", color: "#92400e", padding: 12, borderRadius: 8, marginBottom: 16, border: "1px solid #fde68a", fontSize: 13 }}>
          ⚠️ {senderStatus.freeMailWarning}
        </div>
      )}

      {senderStatus && (
        <div style={{ background: "#f8fafc", color: "#475569", padding: "8px 12px", borderRadius: 8, marginBottom: 16, fontSize: 12, border: "1px solid #e2e8f0" }}>
          Daily send limit: {senderStatus.sentToday}/{senderStatus.dailyCap} sent today &bull; {senderStatus.remaining} remaining
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>To</label>
        <input
          type="email"
          value={toEmail}
          onChange={(e) => setToEmail(e.target.value)}
          placeholder="recipient@email.com"
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            fontSize: 14,
            boxSizing: "border-box",
          }}
        />
        {toName && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{toName}</div>}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>CC</label>
        <input
          type="email"
          value={cc}
          onChange={(e) => setCc(e.target.value)}
          placeholder="cc@example.com"
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            fontSize: 14,
            boxSizing: "border-box",
          }}
        />
        {cc && (
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {ccName && <span>{ccName} &lt;</span>}
            {cc}
            {ccName && <span>&gt;</span>}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject"
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            fontSize: 14,
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Template</label>
        <select
          value={selectedTemplate?.id || ""}
          onChange={(e) => {
            const tpl = templates.find((t) => t.id === e.target.value);
            if (tpl) {
              setSelectedTemplate(tpl);
              setSubject(tpl.subject);
              setBody(tpl.body);
            } else {
              setSelectedTemplate(null);
            }
          }}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            fontSize: 14,
            boxSizing: "border-box",
          }}
        >
          <option value="">Select a template...</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name} ({tpl.category})
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          placeholder="Email body..."
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            fontSize: 14,
            boxSizing: "border-box",
            fontFamily: "monospace",
          }}
        />
      </div>

      <button
        onClick={handleSend}
        disabled={sending}
        style={{
          padding: "10px 32px",
          background: sending ? "#94a3b8" : "#1e40af",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: sending ? "not-allowed" : "pointer",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {sending ? "Sending..." : "Send Email"}
      </button>
    </div>
  );
}

export default function ComposePage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading...</div>}>
      <ComposeContent />
    </Suspense>
  );
}
