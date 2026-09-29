"use client";

import { useEffect, useState } from "react";
import type { EmailLog } from "@/lib/types";

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
      <div className="text-center text-slate-400 p-10">
        Loading sent emails...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[900px] mx-auto my-0">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        📤 Sent Emails ({logs.length})
      </h1>

      {logs.length === 0 ? (
        <div className="text-center text-slate-400 p-10">
          No emails sent yet. Go to <a href="/emails">Compose</a> to send one.
        </div>
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
                    To: {log.toName || log.toEmail} • {new Date(log.sentAt).toLocaleString()}
                  </div>
                </div>
                <span className={`${`text-[11px] px-2 py-0.5 font-semibold ${log.status === "SENT" ? "bg-green-100 text-green-800" : "bg-red-50 text-red-600"}`} rounded`}
                >
                  {log.status}
                </span>
              </div>
              {log.errorCode && (
                <div className="text-xs text-red-600 mt-2">Error: {log.errorCode}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
