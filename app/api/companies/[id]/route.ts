import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { isValidStatus } from "@/lib/status";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { id } = await params;
    const company = await prisma.company.findFirst({
      where: { id, ...branchFilter },
      include: {
        contacts: { orderBy: { firstName: "asc" } },
        projects: { orderBy: { createdAt: "desc" } },
        activities: { orderBy: { date: "desc" }, take: 50 },
        leads: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error("Error fetching company:", error);
    return NextResponse.json({ error: "Failed to fetch company" }, { status: 500 });
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
    const body = await request.json();
    const { name, industry, address, website, email, mobile1, mobile2, mobile3, landline1, landline2, landline3, status, notes, source } = body;

    const existing = await prisma.company.findFirst({ where: { id, ...branchFilter } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (status !== undefined && status && !(await isValidStatus(existing.branchId, "company", status))) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }
    if (industry !== undefined && industry && !(await isValidStatus(existing.branchId, "industry", industry))) {
      return NextResponse.json({ error: `Invalid industry: ${industry}` }, { status: 400 });
    }

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(industry !== undefined && { industry }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(website !== undefined && { website: website?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(mobile1 !== undefined && { mobile1: mobile1?.trim() || null }),
        ...(mobile2 !== undefined && { mobile2: mobile2?.trim() || null }),
        ...(mobile3 !== undefined && { mobile3: mobile3?.trim() || null }),
        ...(landline1 !== undefined && { landline1: landline1?.trim() || null }),
        ...(landline2 !== undefined && { landline2: landline2?.trim() || null }),
        ...(landline3 !== undefined && { landline3: landline3?.trim() || null }),
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(source !== undefined && { source: source?.trim() || null }),
      },
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error("Error updating company:", error);
    return NextResponse.json({ error: "Failed to update company" }, { status: 500 });
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
    const existing = await prisma.company.findFirst({ where: { id, ...branchFilter } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.company.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting company:", error);
    return NextResponse.json({ error: "Failed to delete company" }, { status: 500 });
  }
}