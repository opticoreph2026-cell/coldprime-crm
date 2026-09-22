import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    let session;
    try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const template = await prisma.emailTemplate.findFirst({
      where: { id, branchId: branchFilter.branchId },
    });
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    return NextResponse.json(template);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "No branch assigned") return NextResponse.json({ error: "No branch assigned" }, { status: 400 });
    console.error("Error fetching template:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    let session;
    try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const { id } = await params;
    const body = await request.json();
    const { name, subject, body: bodyContent, category } = body;
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await prisma.emailTemplate.updateMany({
      where: { id, branchId: branchFilter.branchId },
      data: { name, subject, body: bodyContent, category, updatedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "No branch assigned") return NextResponse.json({ error: "No branch assigned" }, { status: 400 });
    console.error("Error updating template:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    let session;
    try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await prisma.emailTemplate.updateMany({
      where: { id, branchId: branchFilter.branchId },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "No branch assigned") return NextResponse.json({ error: "No branch assigned" }, { status: 400 });
    console.error("Error deleting template:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
