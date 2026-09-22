"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Template {
  id: string;
  name: string;
  subject: string;
  category: string | null;
}

interface Recipient {
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

export default function EmailsPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [activeTab, setActiveTab] = useState<"compose" | "sent">("compose");
  const [loading, setLoading] = useState(true);

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
          ...recData.map((c: any) => ({
            email: c.email,
            name: `${c.firstName} ${c.lastName || ""}`.trim(),
            type: "contact" as const,
            companyName: c.company?.name,
          })),
          ...compData.map((c: any) => ({
            email: c.email,
            name: c.name,
            type: "company" as const,
            industry: c.industry,
          })),
        ];
        setRecipients(allRecipients);
        setLogs(logRes.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
        Loading emails...
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 24 }}>
        ✉️ Email Outreach
      </h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab("compose")}
          style={{
            padding: "8px 16px",
            background: activeTab === "compose" ? "#1e40af" : "#e2e8f0",
            color: activeTab === "compose" ? "#fff" : "#0f172a",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Compose Email
        </button>
        <button
          onClick={() => setActiveTab("sent")}
          style={{
            padding: "8px 16px",
            background: activeTab === "sent" ? "#1e40af" : "#e2e8f0",
            color: activeTab === "sent" ? "#fff" : "#0f172a",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Sent History ({logs.length})
        </button>
      </div>

      {activeTab === "compose" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Select Template</h2>
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => router.push(`/emails/compose?template=${tpl.id}`)}
                style={{
                  padding: 12,
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  marginBottom: 8,
                  cursor: "pointer",
                  background: "#fff",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
              >
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
                  {tpl.category}
                </span>
              </div>
            ))}
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Recipients</h2>
            <div style={{ maxHeight: 400, overflow: "auto" }}>
              {recipients.map((r, i) => (
                <div
                  key={i}
                  onClick={() => router.push(`/emails/compose?to=${r.email}&toName=${r.name || ""}`)}
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
            <p style={{ color: "#94a3b8", fontSize: 14 }}>No emails sent yet. Select a template or recipient to compose one.</p>
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
