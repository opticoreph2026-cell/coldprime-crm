import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { parseOr400, readJson } from "@/lib/validations";
import { projectUpdateSchema } from "@/lib/validations/project";
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
    const project = await prisma.project.findFirst({
      where: { id, ...branchFilter },
      include: {
        company: true,
        contact: true,
        activities: { orderBy: { date: "desc" } },
      },
    });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(project);
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
    const existing = await prisma.project.findFirst({ where: { id, ...branchFilter }, include: { company: { select: { name: true } } } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = parseOr400(projectUpdateSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    if (body.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: body.contactId, ...branchFilter },
        select: { id: true },
      });
      if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(body.projectName !== undefined && { projectName: body.projectName.trim() }),
        ...(body.projectLocation !== undefined && { projectLocation: body.projectLocation?.trim() || null }),
        ...(body.projectType !== undefined && { projectType: body.projectType?.trim() || null }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.contactId !== undefined && { contactId: body.contactId || null }),
        ...(body.assignedTo !== undefined && { assignedTo: body.assignedTo?.trim() || null }),
        ...(body.quotationDate !== undefined && { quotationDate: body.quotationDate ? new Date(body.quotationDate) : null }),
        ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
        ...(body.targetCompletion !== undefined && { targetCompletion: body.targetCompletion ? new Date(body.targetCompletion) : null }),
        ...(body.actualCompletion !== undefined && { actualCompletion: body.actualCompletion ? new Date(body.actualCompletion) : null }),
        ...(body.installationStatus !== undefined && { installationStatus: body.installationStatus }),
        ...(body.testingStatus !== undefined && { testingStatus: body.testingStatus }),
        ...(body.commissioningStatus !== undefined && { commissioningStatus: body.commissioningStatus }),
        ...(body.remarks !== undefined && { remarks: body.remarks?.trim() || null }),
      },
    });

    const projectLabel = project.projectName;
    const auditBase = { userId: session.user.id, branchId: existing.branchId, entity: "project" as const, entityId: id, details: { companyId: existing.companyId, companyName: existing.company?.name || null, label: projectLabel } };
    await logAudit({ ...auditBase, action: "UPDATE" });
    if (body.status !== undefined && body.status !== existing.status) {
      await logAudit({ ...auditBase, action: "STATUS_CHANGE", details: { ...auditBase.details, from: existing.status, to: project.status } });
    }
    return NextResponse.json(project);
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
    const existing = await prisma.project.findFirst({ where: { id, ...branchFilter }, include: { company: { select: { name: true } } } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.project.delete({ where: { id } });
    await logAudit({ userId: session.user.id, branchId: existing.branchId, action: "DELETE", entity: "project", entityId: id, details: { companyId: existing.companyId, companyName: existing.company?.name || null, label: existing.projectName } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isForeignKeyError(error)) {
      return NextResponse.json(
        { error: "Cannot delete this project while related activities or documents still reference it." },
        { status: 409 }
      );
    }
    console.error("Error deleting project:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}