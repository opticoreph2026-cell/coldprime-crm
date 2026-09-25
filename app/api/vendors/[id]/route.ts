import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { parseOr400, readJson } from "@/lib/validations";
import { vendorUpdateSchema } from "@/lib/validations/vendor";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const { id } = await params;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true, slug: true } },
        contacts: { orderBy: { createdAt: "desc" } },
        materials: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    if (branchFilter.branchId && vendor.branchId !== branchFilter.branchId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(vendor);
  } catch (error) {
    console.error("Error fetching vendor:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const { id } = await params;
    const parsed = parseOr400(vendorUpdateSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const { name, category, address, website, email, mobile1, mobile2, landline1, landline2, status, notes } = body;

    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    if (branchFilter.branchId && vendor.branchId !== branchFilter.branchId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.vendor.update({
      where: { id },
      data: {
        name: name?.trim() || vendor.name,
        category: category || vendor.category,
        address: address?.trim() || vendor.address,
        website: website?.trim() || vendor.website,
        email: email?.trim() || vendor.email,
        mobile1: mobile1?.trim() || vendor.mobile1,
        mobile2: mobile2?.trim() || vendor.mobile2,
        landline1: landline1?.trim() || vendor.landline1,
        landline2: landline2?.trim() || vendor.landline2,
        status: status || vendor.status,
        notes: notes?.trim() || vendor.notes,
      },
      include: { branch: { select: { id: true, name: true, slug: true } } },
    });

    await logAudit({ branchId: branchFilter.branchId ?? vendor.branchId, action: "UPDATE", entity: "Vendor", entityId: vendor.id, details: { name: updated.name } });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating vendor:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const { id } = await params;

    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    if (branchFilter.branchId && vendor.branchId !== branchFilter.branchId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.vendor.delete({ where: { id } });
    await logAudit({ branchId: branchFilter.branchId ?? vendor.branchId, action: "DELETE", entity: "Vendor", entityId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting vendor:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
