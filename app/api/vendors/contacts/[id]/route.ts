import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth, requireBranchId } from "@/lib/branch";
import { logAudit } from "@/lib/audit";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const { id } = await params;
    const body = await request.json();
    const { firstName, lastName, position, email, mobile, landline, contactPreference, notes } = body;

    const contact = await prisma.vendorContact.findUnique({
      where: { id },
      include: { vendor: { select: { branchId: true } } },
    });
    if (!contact || contact.vendor.branchId !== branchFilter.branchId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.vendorContact.update({
      where: { id },
      data: {
        firstName: firstName?.trim() || contact.firstName,
        lastName: lastName?.trim() || contact.lastName,
        position: position?.trim() || contact.position,
        email: email?.trim() || contact.email,
        mobile: mobile?.trim() || contact.mobile,
        landline: landline?.trim() || contact.landline,
        contactPreference: contactPreference || contact.contactPreference,
        notes: notes?.trim() || contact.notes,
      },
    });

    await logAudit({ branchId: branchFilter.branchId, action: "UPDATE", entity: "VendorContact", entityId: contact.id, details: { name: `${updated.firstName} ${updated.lastName || ""}` } });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating vendor contact:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const { id } = await params;

    const contact = await prisma.vendorContact.findUnique({
      where: { id },
      include: { vendor: { select: { branchId: true } } },
    });
    if (!contact || contact.vendor.branchId !== branchFilter.branchId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.vendorContact.delete({ where: { id } });
    await logAudit({ branchId: branchFilter.branchId, action: "DELETE", entity: "VendorContact", entityId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting vendor contact:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
