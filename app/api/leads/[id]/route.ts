import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LeadType } from "@/lib/prisma/client/client";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { isValidStatus } from "@/lib/status";
import { isLeadType } from "@/lib/enums";
import { parseOr400, readJson } from "@/lib/validations";
import { leadUpdateSchema } from "@/lib/validations/lead";
import { isForeignKeyError } from "@/lib/prisma-error";
import { logAudit } from "@/lib/audit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { id } = await params;
    const lead = await prisma.lead.findFirst({
      where: { id, ...branchFilter },
      include: {
        company: true,
        contact: true,
      },
    });
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(lead);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let session; try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { id } = await params;
    const existing = await prisma.lead.findFirst({ where: { id, ...branchFilter }, include: { company: { select: { name: true } } } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = parseOr400(leadUpdateSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    if (body.type !== undefined && !isLeadType(body.type)) {
      return NextResponse.json({ error: `Invalid lead type: ${body.type}` }, { status: 400 });
    }
    if (body.status !== undefined && !(await isValidStatus(existing.branchId, "lead", body.status))) {
      return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 });
    }
    // Cross-branch guard: company/contact updates must stay in the lead's branch.
    if (body.companyId) {
      const company = await prisma.company.findFirst({ where: { id: body.companyId }, select: { branchId: true } });
      if (!company || company.branchId !== existing.branchId) {
        return NextResponse.json({ error: "Company not found in your branch" }, { status: 400 });
      }
    }
    if (body.contactId) {
      const contact = await prisma.contact.findFirst({ where: { id: body.contactId }, select: { branchId: true } });
      if (!contact || contact.branchId !== existing.branchId) {
        return NextResponse.json({ error: "Contact not found in your branch" }, { status: 400 });
      }
    }

    const statusChanged = body.status !== undefined && body.status !== existing.status;

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(body.type !== undefined && { type: body.type as LeadType }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.companyId !== undefined && { companyId: body.companyId || null }),
        ...(body.contactId !== undefined && { contactId: body.contactId || null }),
        ...(body.lastContactDate !== undefined && { lastContactDate: body.lastContactDate ? new Date(body.lastContactDate) : null }),
        ...(body.nextFollowUp !== undefined && { nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : null }),
        ...(body.notes !== undefined && { notes: body.notes?.trim() || null }),
        ...(body.assignedTo !== undefined && { assignedTo: body.assignedTo }),
        ...(body.estimatedValue !== undefined && { estimatedValue: body.estimatedValue ? Number(body.estimatedValue) : null }),
      },
    });

    const leadLabel = existing.company?.name || "Lead";
    const auditBase = { userId: session.user.id, branchId: existing.branchId, entity: "lead" as const, entityId: id, details: { companyId: existing.companyId, companyName: existing.company?.name || null, label: leadLabel } };
    await logAudit({ ...auditBase, action: "UPDATE" });
    if (statusChanged) {
      await logAudit({ ...auditBase, action: "STATUS_CHANGE", details: { ...auditBase.details, from: existing.status, to: lead.status } });
    }
    return NextResponse.json(lead);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let session; try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { id } = await params;
    const existing = await prisma.lead.findFirst({ where: { id, ...branchFilter }, include: { company: { select: { name: true } } } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.lead.delete({ where: { id } });
    await logAudit({ userId: session.user.id, branchId: existing.branchId, action: "DELETE", entity: "lead", entityId: id, details: { companyId: existing.companyId, companyName: existing.company?.name || null, label: existing.company?.name || "Lead" } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isForeignKeyError(error)) {
      return NextResponse.json(
        { error: "Cannot delete this lead while related documents still reference it." },
        { status: 409 }
      );
    }
    console.error("Error deleting lead:", error);
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }
}