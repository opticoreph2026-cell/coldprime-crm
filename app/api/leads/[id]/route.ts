import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LeadType } from "@/lib/prisma/client/client";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { isValidStatus } from "@/lib/status";
import { isLeadType } from "@/lib/enums";
import { parseOr400, readJson } from "@/lib/validations";
import { leadUpdateSchema } from "@/lib/validations/lead";
import { isForeignKeyError } from "@/lib/prisma-error";

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
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { id } = await params;
    const existing = await prisma.lead.findFirst({ where: { id, ...branchFilter } });
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

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(body.type !== undefined && { type: body.type as LeadType }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.lastContactDate !== undefined && { lastContactDate: body.lastContactDate ? new Date(body.lastContactDate) : null }),
        ...(body.nextFollowUp !== undefined && { nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : null }),
        ...(body.notes !== undefined && { notes: body.notes?.trim() || null }),
        ...(body.assignedTo !== undefined && { assignedTo: body.assignedTo }),
        ...(body.estimatedValue !== undefined && { estimatedValue: body.estimatedValue ? Number(body.estimatedValue) : null }),
      },
    });
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
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { id } = await params;
    const existing = await prisma.lead.findFirst({ where: { id, ...branchFilter } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.lead.delete({ where: { id } });
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