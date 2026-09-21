const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) console.warn("RESEND_API_KEY not set");
const RESEND_API = "https://api.resend.com";

export interface EmailData {
  to: string;
  toName?: string;
  subject: string;
  body: string;
  fromName?: string;
  fromEmail?: string;
}

export function fillTemplate(body: string, data: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || "");
}

export async function sendEmail({
  to, toName, subject, body, fromName, fromEmail,
}: EmailData) {
  const from = `${fromName || "Coldprime CRM"} <${fromEmail || "no-reply@coldprime-crm.vercel.app"}>`;
  const toStr = toName ? `${toName} <${to}>` : to;

  const response = await fetch(`${RESEND_API}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from, to: toStr, subject, html: body }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || "Failed to send email");
  }

  return response.json();
}

export async function logEmail(
  prisma: any,
  branchId: string,
  templateId: string | null,
  fromUserId: string,
  toEmail: string,
  toName: string | null,
  subject: string,
  status: string,
  errorCode: string | null = null,
  metadata: any = null,
) {
  await prisma.emailLog.create({
    data: {
      branchId,
      templateId,
      fromUserId,
      toEmail,
      toName,
      subject,
      status: status as any,
      errorCode,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}
