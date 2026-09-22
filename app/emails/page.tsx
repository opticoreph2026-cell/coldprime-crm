"use client";

export const dynamic = "force-dynamic";

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

export default function EmailsPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [activeTab, setActiveTab] = useState<"compose" | "sent">("compose");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/emails/templates").then((r) => r.json()),
      fetch("/api/emails").then((r) => r.json()),
    ])
      .then(([tplRes, recRes]) => {
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
          Sent History ({templates.length})
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
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Sent Emails</h2>
          <p style={{ color: "#94a3b8", fontSize: 14 }}>Check /api/emails/logs for sent history</p>
        </div>
      )}
    </div>
  );
}
