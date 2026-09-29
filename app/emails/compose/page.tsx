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
      <div className="text-center p-10">
        <div className="text-5xl mb-4 text-green-500">✅</div>
        <h2 className="text-2xl font-bold text-slate-900">Email Sent Successfully!</h2>
        {warnings.length > 0 && (
          <div className="bg-amber-50 border border-yellow-200 text-amber-800 text-left text-[13px] max-w-160 p-3 rounded-lg mb-0 mx-auto mt-4">
            <div className="font-bold mb-1.5">Sent, but {warnings.length} deliverability warning{warnings.length > 1 ? "s" : ""}:</div>
            <ul className="leading-[1.6] mr-[18px] mb-0 ml-0 mt-0">
              {warnings.map((w, i) => (<li key={i}>{w}</li>))}
            </ul>
          </div>
        )}
        <button
          onClick={() => router.push("/emails")} className="mt-4 px-6 py-2.5 bg-blue-800 text-white cursor-pointer text-sm font-semibold border-0 rounded-md"
        >
          Back to Emails
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[900px] mx-auto my-0">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        ✉️ Compose Email
      </h1>

      {error && (
        <div className="bg-red-50 text-red-600 mb-4 p-3 rounded-lg">
          {error}
        </div>
      )}

      {senderStatus?.freeMailWarning && (
        <div className="bg-amber-50 text-amber-800 mb-4 border border-yellow-200 text-[13px] p-3 rounded-lg">
          ⚠️ {senderStatus.freeMailWarning}
        </div>
      )}

      {senderStatus && (
        <div className="bg-slate-50 text-slate-600 px-3 py-2 mb-4 text-xs border border-slate-200 rounded-lg">
          Daily send limit: {senderStatus.sentToday}/{senderStatus.dailyCap} sent today &bull; {senderStatus.remaining} remaining
        </div>
      )}

      <div className="mb-4">
        <label className="block text-[13px] font-semibold mb-1">To</label>
        <input
          type="email"
          value={toEmail}
          onChange={(e) => setToEmail(e.target.value)}
          placeholder="recipient@email.com" className="w-full px-3 py-2 border border-slate-200 text-sm rounded-md box-border"
        />
        {toName && <div className="text-xs text-slate-500 mt-1">{toName}</div>}
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-semibold mb-1">CC</label>
        <input
          type="email"
          value={cc}
          onChange={(e) => setCc(e.target.value)}
          placeholder="cc@example.com" className="w-full px-3 py-2 border border-slate-200 text-sm rounded-md box-border"
        />
        {cc && (
          <div className="text-xs text-slate-500 mt-1">
            {ccName && <span>{ccName} &lt;</span>}
            {cc}
            {ccName && <span>&gt;</span>}
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-semibold mb-1">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject" className="w-full px-3 py-2 border border-slate-200 text-sm rounded-md box-border"
        />
      </div>

      <div className="mb-4">
        <label className="block text-[13px] font-semibold mb-1">Template</label>
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
          }} className="w-full px-3 py-2 border border-slate-200 text-sm rounded-md box-border"
        >
          <option value="">Select a template...</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name} ({tpl.category})
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <label className="block text-[13px] font-semibold mb-1">Body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          placeholder="Email body..." className="w-full px-3 py-2 border border-slate-200 text-sm rounded-md box-border font-mono"
        />
      </div>

      <button
        onClick={handleSend}
        disabled={sending} className={`${`${`px-8 py-2.5 text-white text-sm font-bold ${sending ? "bg-slate-400 cursor-not-allowed" : "bg-blue-800 cursor-pointer"}`} border-0`} rounded-md`}
      >
        {sending ? "Sending..." : "Send Email"}
      </button>
    </div>
  );
}

export default function ComposePage() {
  return (
    <Suspense fallback={<div className="text-center text-slate-400 p-10">Loading...</div>}>
      <ComposeContent />
    </Suspense>
  );
}
