"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string | null;
}

export default function ComposePage() {
  const router = useRouter();
  const params = useParams();
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

  useEffect(() => {
    fetch("/api/emails/templates")
      .then((r) => r.json())
      .then((res) => setTemplates(res.data || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const templateId = params.template as string | undefined;
    const to = params.to as string | undefined;
    const name = params.toName as string | undefined;
    if (to) setToEmail(to);
    if (name) setToName(name);
    if (templateId) {
      const tpl = templates.find((t) => t.id === templateId);
      if (tpl) {
        setSelectedTemplate(tpl);
        setSubject(tpl.subject);
        setBody(tpl.body);
      }
    }
  }, [params, templates]);

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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }, [toEmail, toName, cc, ccName, subject, body, selectedTemplate]);

  if (sent) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#22c55e" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Email Sent Successfully!</h2>
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
