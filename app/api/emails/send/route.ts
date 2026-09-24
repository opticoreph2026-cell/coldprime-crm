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
      // Substitute placeholders, but never replace content the user already edited.
      const branchName = branchFilter.branchId
        ? ((await prisma.branch.findUnique({ where: { id: branchFilter.branchId }, select: { name: true } }))?.name || "All Branches")
        : "All Branches";
      const vars = {
        companyName: companyName || "",
        contactName: toName || "",
        branchName,
        senderName: fromName || session.user.name || "Coldprime CRM",
        branchLocation: "",
        targetDate: "",
      };
      if (!finalSubject) finalSubject = fillTemplate(template.subject, vars);
      finalBody = fillTemplate(finalBody || template.body, vars);
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

    try {
      const matched = await prisma.company.findMany({
        where: {
          ...branchFilter,
          OR: [{ email: toEmail }, { contacts: { some: { email: toEmail } } }],
        },
        select: { id: true, outreachStatus: true },
      });
      for (const c of matched) {
        await prisma.company.update({
          where: { id: c.id },
          data: {
            lastEmailedAt: new Date(),
            ...(c.outreachStatus !== "REPLIED" && { outreachStatus: "EMAILED" }),
          },
        });
      }
    } catch (updErr) {
      console.error("Failed to update outreach status:", updErr);
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
