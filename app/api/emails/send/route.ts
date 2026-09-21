import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { sendEmail, fillTemplate, logEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    await requireAuth();
    const branchFilter = await getBranchFilter();
    const session = await requireAuth();
    const body = await request.json();
    const { toEmail, toName, templateId, subject, body: bodyContent, fromName, companyName } = body;

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
        branchName: branchFilter.branchId ? (await prisma.branch.findUnique({ where: { id: branchFilter.branchId }, select: { name: true } })).name || "All Branches" : "All Branches",
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
    });

    await logEmail(prisma, branchFilter.branchId, templateId || null, session.user.id, toEmail, toName || null, finalSubject, "SENT", null, { resendId: result.id });

    return NextResponse.json({ success: true, message: "Email sent", data: result });
  } catch (error: any) {
    console.error("Error sending email:", error);
    try {
      const session = await requireAuth();
      await logEmail(prisma, (await getBranchFilter()).branchId, null, session.user.id, body.toEmail || "", body.toName || null, body.subject || "", "FAILED", error.message);
    } catch {}
    return NextResponse.json({ error: error.message || "Failed to send email" }, { status: 500 });
  }
}
