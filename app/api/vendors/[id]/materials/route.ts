import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { parseOr400, readJson } from "@/lib/validations";
import { vendorMaterialCreateSchema } from "@/lib/validations/vendor";
import { toLeadTimeDays } from "@/lib/validations/product";
import { stripCost, viewerCanSeeCost } from "@/lib/cost";

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

    return NextResponse.json({ data: (await viewerCanSeeCost()) ? materials : stripCost(materials) });
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
    const parsed = parseOr400(vendorMaterialCreateSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const { itemName, category, brand, model, unit, unitPrice, currency, priceValidUntil, leadTimeDays, notes } = body;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      select: { branchId: true },
    });
    if (!vendor || vendor.branchId !== branchFilter.branchId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Cost prices are a restricted field (company policy, lib/cost.ts).
    if (unitPrice && !(await viewerCanSeeCost())) {
      return NextResponse.json({ error: "Cost prices are restricted" }, { status: 403 });
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
        leadTimeDays: toLeadTimeDays(leadTimeDays),
        notes: notes?.trim() || null,
      },
    });

    await logAudit({ branchId: branchFilter.branchId, action: "CREATE", entity: "vendor_material", entityId: material.id, details: { vendorId: id, itemName } });

    return NextResponse.json((await viewerCanSeeCost()) ? material : stripCost(material), { status: 201 });
  } catch (error) {
    console.error("Error creating vendor material:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
