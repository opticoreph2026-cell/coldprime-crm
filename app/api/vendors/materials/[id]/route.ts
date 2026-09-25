import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { parseOr400, readJson } from "@/lib/validations";
import { vendorMaterialUpdateSchema } from "@/lib/validations/vendor";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const { id } = await params;
    const parsed = parseOr400(vendorMaterialUpdateSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const { itemName, category, brand, model, unit, unitPrice, currency, priceValidUntil, notes } = body;

    const material = await prisma.vendorMaterial.findUnique({
      where: { id },
      include: { vendor: { select: { branchId: true } } },
    });
    if (!material || material.vendor.branchId !== branchFilter.branchId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.vendorMaterial.update({
      where: { id },
      data: {
        itemName: itemName?.trim() || material.itemName,
        category: category || material.category,
        brand: brand || material.brand,
        model: model || material.model,
        unit: unit || material.unit,
        unitPrice: unitPrice ? Number(unitPrice) : material.unitPrice,
        currency: currency || material.currency,
        priceValidUntil: priceValidUntil ? new Date(priceValidUntil) : material.priceValidUntil,
        notes: notes?.trim() || material.notes,
      },
    });

    await logAudit({ branchId: branchFilter.branchId, action: "UPDATE", entity: "VendorMaterial", entityId: material.id, details: { itemName } });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating vendor material:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const { id } = await params;

    const material = await prisma.vendorMaterial.findUnique({
      where: { id },
      include: { vendor: { select: { branchId: true } } },
    });
    if (!material || material.vendor.branchId !== branchFilter.branchId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.vendorMaterial.delete({ where: { id } });
    await logAudit({ branchId: branchFilter.branchId, action: "DELETE", entity: "VendorMaterial", entityId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting vendor material:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
