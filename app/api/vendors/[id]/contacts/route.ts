import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/prisma/client/client";
import { getBranchFilter, requireAuth, requireBranchId } from "@/lib/branch";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const { id } = await params;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      select: { branchId: true },
    });
    if (!vendor || vendor.branchId !== branchFilter.branchId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const contacts = await prisma.vendorContact.findMany({
      where: { vendorId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: contacts });
  } catch (error) {
    console.error("Error fetching vendor contacts:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const { id } = await params;
    const body = await request.json();
    const { firstName, lastName, position, email, mobile, landline, contactPreference, notes } = body;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      select: { branchId: true },
    });
    if (!vendor || vendor.branchId !== branchFilter.branchId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const contact = await prisma.vendorContact.create({
      data: {
        vendorId: id,
        firstName: firstName.trim(),
        lastName: lastName?.trim() || null,
        position: position?.trim() || null,
        email: email?.trim() || null,
        mobile: mobile?.trim() || null,
        landline: landline?.trim() || null,
        contactPreference: contactPreference || null,
        notes: notes?.trim() || null,
      },
    });

    await logAudit({ branchId: branchFilter.branchId, action: "CREATE", entity: "VendorContact", entityId: contact.id, details: { vendorId: id, name: `${firstName} ${lastName || ""}` } });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("Error creating vendor contact:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
