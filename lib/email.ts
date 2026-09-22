const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) console.warn("RESEND_API_KEY not set");
const RESEND_API = "https://api.resend.com";
const DEFAULT_FROM = "Coldprime CRM <admin@coldprime.ph>";

export interface EmailData {
  to: string;
  toName?: string;
  subject: string;
  body: string;
  fromName?: string;
  fromEmail?: string;
  cc?: string;
  ccName?: string;
}

export function fillTemplate(body: string, data: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || "");
}

export async function sendEmail({
  to, toName, subject, body, fromName, fromEmail, cc, ccName,
}: EmailData) {
  const from = fromEmail
    ? `${fromName || fromEmail} <${fromEmail}>`
    : DEFAULT_FROM;
  const toStr = toName ? `${toName} <${to}>` : to;

  const emailData: Record<string, unknown> = {
    from,
    to: toStr,
    subject,
    html: body,
  };

  if (cc) {
    emailData.cc = ccName ? `${ccName} <${cc}>` : cc;
  }

  let parsed;
  try {
    const response = await fetch(`${RESEND_API}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailData),
    });
    if (!response.ok) {
      let errorMsg = "Unknown error";
      try { parsed = await response.json(); } catch {}
      errorMsg = parsed?.message || errorMsg;
      throw new Error(errorMsg);
    }
    parsed = await response.json();
  } catch (error: any) {
    if (error.message === "Failed to fetch" || error.message === "Network error") {
      throw new Error("Network error: Unable to reach email service");
    }
    throw error;
  }

  return parsed;
}

export async function logEmail(
  branchId: string,
  templateId: string | null,
  fromUserId: string,
  toEmail: string,
  toName: string | null,
  subject: string,
  status: string,
  errorCode: string | null = null,
  metadata: Record<string, unknown> | null = null,
) {
  const { prisma } = await import("./prisma");
  await prisma.emailLog.create({
    data: {
      branchId,
      templateId,
      fromUserId,
      toEmail,
      toName,
      subject,
      status: status as "SENT" | "FAILED" | "PENDING",
      errorCode,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    },
  });
}
