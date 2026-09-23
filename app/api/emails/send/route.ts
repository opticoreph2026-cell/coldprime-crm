import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { sendEmail, fillTemplate, logEmail } from "@/lib/email";

export async function POST(request: Request) {
  let toEmail = "";
  let toName: string | null = null;
  let subject = "";
  let templateId: string | undefined;
  let cc = "";
  let ccName = "";

  let session;
  let branchFilter;
  try {
    try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    branchFilter = await getBranchFilter();
    const body = await request.json();
    toEmail = body.toEmail || "";
    toName = body.toName || null;
    templateId = body.templateId;
    subject = body.subject || "";
    const bodyContent = body.body || "";
    const fromName = body.fromName;
    const companyName = body.companyName;
    cc = body.cc || "";
    ccName = body.ccName || "";

    if (!toEmail) {
      return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
    }

    let finalSubject = subject || "";
    let finalBody = bodyContent || "";

    if (templateId) {
      const template = await prisma.emailTemplate.findFirst({
        where: { id: templateId, branchId: branchFilter.branchId, isActive: true },
      });
      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      finalSubject = template.subject;
      finalBody = fillTemplate(template.body, {
        companyName: companyName || "",
        contactName: toName || "",
        branchName: branchFilter.branchId ? ((await prisma.branch.findUnique({ where: { id: branchFilter.branchId }, select: { name: true } }))?.name || "All Branches") : "All Branches",
        senderName: fromName || session.user.name || "Coldprime CRM",
        branchLocation: "",
        targetDate: "",
      });
    }

    const result = await sendEmail({
      to: toEmail,
      toName: toName || undefined,
      subject: finalSubject,
      body: finalBody,
      fromName: fromName,
      cc: cc || undefined,
      ccName: ccName || undefined,
    });

    try {
      await logEmail(branchFilter.branchId!, templateId || null, session.user.id!, toEmail, toName || null, finalSubject, "SENT", null, { messageId: result.id, cc });
    } catch (logErr) {
      console.error("Email sent but logging failed:", logErr);
    }

    return NextResponse.json({ success: true, message: "Email sent", data: result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to send email";
    console.error("Error sending email:", error);
    if (session && branchFilter) {
      try { await logEmail(branchFilter.branchId!, templateId || null, session.user.id!, toEmail, toName, subject, "FAILED", msg); } catch {}
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
