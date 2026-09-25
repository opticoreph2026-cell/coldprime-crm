import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { parseOr400, readJson } from "@/lib/validations";
import { vendorContactCreateSchema } from "@/lib/validations/vendor";

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
    const parsed = parseOr400(vendorContactCreateSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
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
