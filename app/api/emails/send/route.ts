import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { sendEmail, fillTemplate, logEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { ensureOptOutLine, evaluateEmailGuard } from "@/lib/email/guard";
import { startOfDayPH, addDaysISO, todayPH } from "@/lib/dates";
import { parseOr400, readJson } from "@/lib/validations";
import { emailSendSchema } from "@/lib/validations/email";

export async function POST(request: Request) {
  let toEmail = "";
  let toName: string | null = null;
  let subject = "";
  let templateId: string | undefined;
  let cc = "";
  let ccName = "";
  let logBranchId: string | undefined;

  let session;
  let branchFilter;
  try {
    try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    branchFilter = await getBranchFilter();
    const parsed = parseOr400(emailSendSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    toEmail = parsed.data.toEmail;
    toName = parsed.data.toName ?? null;
    templateId = parsed.data.templateId ?? undefined;
    subject = parsed.data.subject ?? "";
    const bodyContent = parsed.data.body ?? "";
    const fromName = parsed.data.fromName;
    const companyName = parsed.data.companyName;
    cc = parsed.data.cc || "";
    ccName = parsed.data.ccName || "";

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

    if (!finalBody) {
      return NextResponse.json({ error: "Email body is required" }, { status: 400 });
    }

    // --- Anti-spam guardrails (lib/email/guard.ts, Phase 3) ----------------
    const contact = await prisma.contact.findFirst({
      where: { ...branchFilter, email: { equals: toEmail, mode: "insensitive" } },
      select: { id: true, firstName: true, emailOptOut: true },
    });
    const sevenDaysAgo = startOfDayPH(addDaysISO(todayPH(), -7));
    const todayStart = startOfDayPH(todayPH());
    const toEmailMatch = { equals: toEmail, mode: "insensitive" as const };
    const [sentLast7Days, sentAllTime, sentToday] = await Promise.all([
      prisma.emailLog.count({ where: { toEmail: toEmailMatch, status: "SENT", sentAt: { gte: sevenDaysAgo } } }),
      prisma.emailLog.count({ where: { toEmail: toEmailMatch, status: "SENT" } }),
      prisma.emailLog.count({ where: { fromUserId: session.user.id!, status: "SENT", sentAt: { gte: todayStart } } }),
    ]);

    const rawTemplate = templateId
      ? await prisma.emailTemplate.findFirst({ where: { id: templateId, isActive: true }, select: { subject: true, body: true } })
      : null;

    const guard = evaluateEmailGuard({
      toEmail,
      toName,
      subject: finalSubject,
      rawSubject: rawTemplate?.subject,
      rawBody: rawTemplate ? (bodyContent || rawTemplate.body) : bodyContent,
      body: finalBody,
      fromEmail: process.env.GMAIL_USER,
      contactOptOut: contact?.emailOptOut || false,
      extraRecipients: cc ? 1 : 0,
      sentLast7Days,
      sentAllTime,
      sentToday,
    });
    if (guard.blocked) {
      return NextResponse.json({ error: guard.blocked }, { status: 403 });
    }

    // Rule 2: plain opt-out line rides along with every send.
    finalBody = ensureOptOutLine(finalBody);

    const result = await sendEmail({
      to: toEmail,
      toName: toName || undefined,
      subject: finalSubject,
      body: finalBody,
      fromName: fromName || undefined,
      cc: cc || undefined,
      ccName: ccName || undefined,
    });

    // Resolve a concrete branch for EmailLog/audit: active branch, else the
    // recipient's company branch, else the sender's home branch (all-branches view).
    logBranchId = branchFilter.branchId;
    if (!logBranchId) {
      const recipient = await prisma.company.findFirst({
        where: { OR: [{ email: toEmail }, { contacts: { some: { email: toEmail } } }] },
        select: { branchId: true },
      });
      logBranchId = recipient?.branchId ?? session.user.branchId ?? undefined;
    }

    try {
      if (logBranchId) await logEmail(logBranchId, templateId || null, session.user.id!, toEmail, toName || null, finalSubject, "SENT", null, { messageId: result.id, cc });
    } catch (logErr) {
      console.error("Email sent but logging failed:", logErr);
    }

    try {
      if (logBranchId) {
        await logAudit({ userId: session.user.id, branchId: logBranchId, action: "CREATE", entity: "email", details: { companyId: null, companyName: companyName || null, label: finalSubject } });
      }
    } catch (auditErr) {
      console.error("Email audit failed:", auditErr);
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

    // Rule 5b: two follow-ups reached -> park the lead on Nurture.
    if (guard.nurture && contact) {
      try {
        const nurtureLeads = await prisma.lead.findMany({
          where: {
            status: { notIn: ["Won", "Lost", "Nurture"] },
            OR: [
              { contactId: contact.id },
              { company: { email: { equals: toEmail, mode: "insensitive" } } },
            ],
          },
          select: { id: true, status: true, branchId: true },
        });
        for (const lead of nurtureLeads) {
          await prisma.lead.update({ where: { id: lead.id }, data: { status: "Nurture" } });
          await logAudit({
            userId: session.user.id,
            branchId: lead.branchId,
            action: "STATUS_CHANGE",
            entity: "lead",
            entityId: lead.id,
            details: { from: lead.status, to: "Nurture", label: `auto after 2 follow-ups to ${toEmail}` },
          });
        }
      } catch (nurtureErr) {
        console.error("Nurture update failed:", nurtureErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Email sent",
      data: result,
      warnings: guard.warnings,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to send email";
    console.error("Error sending email:", error);
    if (session) {
      const failBranch = logBranchId ?? branchFilter?.branchId;
      try { if (failBranch) await logEmail(failBranch, templateId || null, session.user.id!, toEmail, toName, subject, "FAILED", msg); } catch {}
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
