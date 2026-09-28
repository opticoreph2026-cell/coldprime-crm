// POST /api/emails/opt-out - one-click "Mark as opted out" for an address
// (marks every Contact row with that email in the caller's branch).
// Body: { email: string, undo?: boolean } - undo is admin-only.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { getViewerRole } from "@/lib/cost";
import { parseOr400, readJson } from "@/lib/validations";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

const optOutSchema = z.object({
  email: z.email("Valid email required"),
  undo: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    let session;
    try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const parsed = parseOr400(optOutSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const { email, undo } = parsed.data;

    if (undo) {
      const role = await getViewerRole();
      if (role !== "BRANCH_ADMIN" && role !== "HEAD_ADMIN") {
        return NextResponse.json({ error: "Only admins can undo opt-out" }, { status: 403 });
      }
    }

    const contacts = await prisma.contact.findMany({
      where: { ...branchFilter, email: { equals: email, mode: "insensitive" } },
      select: { id: true, branchId: true },
    });
    if (contacts.length === 0) {
      return NextResponse.json({ error: "No contact found with that email" }, { status: 404 });
    }

    await prisma.contact.updateMany({
      where: { id: { in: contacts.map((c) => c.id) } },
      data: undo
        ? { emailOptOut: false, emailOptOutAt: null }
        : { emailOptOut: true, emailOptOutAt: new Date() },
    });

    await logAudit({
      userId: session.user.id,
      branchId: contacts[0].branchId,
      action: "UPDATE",
      entity: "contact",
      details: { label: email, emailOptOut: !undo },
    });

    return NextResponse.json({ success: true, updated: contacts.length, emailOptOut: !undo });
  } catch (error) {
    console.error("Error updating opt-out:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
