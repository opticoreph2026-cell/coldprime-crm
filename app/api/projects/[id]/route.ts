import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";

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
  } catch (error) {
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
    const existing = await prisma.project.findFirst({ where: { id, ...branchFilter } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
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
    return NextResponse.json(project);
  } catch (error) {
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
    const existing = await prisma.project.findFirst({ where: { id, ...branchFilter } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}