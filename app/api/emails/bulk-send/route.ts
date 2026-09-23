import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { sendEmail, logEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";

export const maxDuration = 30;

const MAX_PER_REQUEST = 10;
const DELAY_MS = 300;

function personalize(text: string, companyName: string): string {
  return text
    .split("[Company Name]").join(companyName)
    .split("{{companyName}}").join(companyName);
}

export async function POST(request: Request) {
  let session;
  let branchFilter;
  try {
    try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    branchFilter = await getBranchFilter();

    const body = await request.json();
    const subject: string = body.subject || "";
    const bodyContent: string = body.body || "";
    const companyIds: string[] = Array.isArray(body.companyIds) ? body.companyIds : [];
    const skipAlreadySent: boolean = Boolean(body.skipAlreadySent);
    const senderName: string = typeof body.senderName === "string" ? body.senderName.trim() : "";

    if (!subject.trim() || !bodyContent.trim()) {
      return NextResponse.json({ error: "Subject and body are required" }, { status: 400 });
    }
    if (companyIds.length === 0) {
      return NextResponse.json({ error: "No companies selected" }, { status: 400 });
    }

    const companies = await prisma.company.findMany({
      where: { id: { in: companyIds }, ...branchFilter, email: { not: null } },
      select: { id: true, name: true, email: true, branchId: true },
    });

    if (companies.length === 0) {
      return NextResponse.json({ error: "No matching companies with email addresses" }, { status: 404 });
    }

    let targets = companies;
    let skipped = 0;

    if (skipAlreadySent) {
      const already = await prisma.emailLog.findMany({
        where: { subject, status: "SENT", toEmail: { in: companies.map((c) => c.email!) } },
        select: { toEmail: true },
      });
      const sentSet = new Set(already.map((l) => l.toEmail.toLowerCase()));
      const before = targets.length;
      targets = targets.filter((c) => c.email && !sentSet.has(c.email.toLowerCase()));
      skipped = before - targets.length;
    }

    const batch = targets.slice(0, MAX_PER_REQUEST);
    let sent = 0;
    let failed = 0;

    for (const company of batch) {
      const personalized = personalize(bodyContent, company.name);
      try {
        const result = await sendEmail({
          to: company.email!,
          subject,
          body: personalized,
          fromName: senderName || undefined,
        });
        sent++;
        try {
          await logEmail(
            company.branchId,
            null,
            session.user.id!,
            company.email!,
            company.name,
            subject,
            "SENT",
            null,
            { messageId: result.id, bulk: true }
          );
        } catch (logErr) {
          console.error("Email sent but logging failed:", logErr);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed";
        try {
          await logEmail(company.branchId, null, session.user.id!, company.email!, company.name, subject, "FAILED", msg, { bulk: true });
        } catch {}
        failed++;
      }
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    const auditBranchId = branchFilter.branchId || batch[0]?.branchId;
    if (auditBranchId) {
      await logAudit({
        userId: session.user.id,
        branchId: auditBranchId,
        action: "BULK_SEND",
        entity: "Email",
        details: { subject, sent, failed, skipped, requested: companyIds.length },
      });
    }

    return NextResponse.json({ success: true, sent, failed, skipped });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Bulk send failed";
    console.error("Bulk send error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
