"use client";

import { useEffect, useState } from "react";

interface EmailLog {
  id: string;
  toEmail: string;
  toName: string | null;
  subject: string;
  status: string;
  sentAt: string;
  errorCode: string | null;
}

export default function SentPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/emails/logs")
      .then((r) => r.json())
      .then((res) => setLogs(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
        Loading sent emails...
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 24 }}>
        📤 Sent Emails ({logs.length})
      </h1>

      {logs.length === 0 ? (
        <div style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>
          No emails sent yet. Go to <a href="/emails">Compose</a> to send one.
        </div>
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
                    To: {log.toName || log.toEmail} • {new Date(log.sentAt).toLocaleString()}
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
  );
}
