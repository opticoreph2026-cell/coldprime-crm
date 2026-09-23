import nodemailer from "nodemailer";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API = "https://api.resend.com";
const DEFAULT_FROM = "Coldprime CRM <admin@coldprime.ph>";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const FROM_DISPLAY_NAME = process.env.EMAIL_FROM_NAME || "Coldprime CRM";

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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function toHtml(text: string): string {
  if (/<(p|br|div|span|a|b|i|u|strong|em|ul|ol|li|h[1-6]|table|img|blockquote)\b/i.test(text)) {
    return text;
  }
  return text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

async function sendViaGmail({
  to, toName, subject, body, fromName, cc, ccName,
}: EmailData): Promise<{ id: string }> {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: GMAIL_USER!,
      pass: GMAIL_APP_PASSWORD!,
    },
  });

  const info = await transporter.sendMail({
    from: `"${fromName || FROM_DISPLAY_NAME}" <${GMAIL_USER}>`,
    to: toName ? `${toName} <${to}>` : to,
    cc: cc ? (ccName ? `${ccName} <${cc}>` : cc) : undefined,
    subject,
    html: body,
  });

  return { id: info.messageId || `gmail-${Date.now()}` };
}

async function sendViaResend({
  to, toName, subject, body, fromName, fromEmail, cc, ccName,
}: EmailData): Promise<{ id: string }> {
  if (!RESEND_API_KEY) {
    throw new Error(
      "Email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in environment variables."
    );
  }

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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "Failed to fetch" || msg === "Network error") {
      throw new Error("Network error: Unable to reach email service");
    }
    throw error;
  }

  return parsed;
}

export async function sendEmail(data: EmailData): Promise<{ id: string }> {
  const payload: EmailData = { ...data, body: toHtml(data.body) };
  if (GMAIL_USER && GMAIL_APP_PASSWORD) {
    return sendViaGmail(payload);
  }
  return sendViaResend(payload);
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
