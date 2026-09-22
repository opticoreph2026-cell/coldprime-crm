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

    const materials = await prisma.vendorMaterial.findMany({
      where: { vendorId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: materials });
  } catch (error) {
    console.error("Error fetching vendor materials:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const { id } = await params;
    const body = await request.json();
    const { itemName, category, brand, model, unit, unitPrice, currency, priceValidUntil, notes } = body;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      select: { branchId: true },
    });
    if (!vendor || vendor.branchId !== branchFilter.branchId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const material = await prisma.vendorMaterial.create({
      data: {
        vendorId: id,
        itemName: itemName.trim(),
        category: category || null,
        brand: brand || null,
        model: model || null,
        unit: unit || null,
        unitPrice: unitPrice ? Number(unitPrice) : null,
        currency: currency || "PHP",
        priceValidUntil: priceValidUntil ? new Date(priceValidUntil) : null,
        notes: notes?.trim() || null,
      },
    });

    await logAudit({ branchId: branchFilter.branchId, action: "CREATE", entity: "VendorMaterial", entityId: material.id, details: { vendorId: id, itemName } });

    return NextResponse.json(material, { status: 201 });
  } catch (error) {
    console.error("Error creating vendor material:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
