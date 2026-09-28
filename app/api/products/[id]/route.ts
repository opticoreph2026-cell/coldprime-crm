import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { parseOr400, readJson } from "@/lib/validations";
import { productUpdateSchema, toLeadTimeDays } from "@/lib/validations/product";
import { isForeignKeyError } from "@/lib/prisma-error";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const { id } = await params;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (branchFilter.branchId && product.branchId !== branchFilter.branchId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const { id } = await params;
    const parsed = parseOr400(productUpdateSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (branchFilter.branchId && product.branchId !== branchFilter.branchId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: body.name?.trim() || product.name,
        category: body.category !== undefined ? body.category || null : product.category,
        brand: body.brand !== undefined ? body.brand || null : product.brand,
        model: body.model !== undefined ? body.model || null : product.model,
        unit: body.unit !== undefined ? body.unit || null : product.unit,
        sellPrice: body.sellPrice !== undefined ? (body.sellPrice ? Number(body.sellPrice) : null) : product.sellPrice,
        currency: body.currency || product.currency,
        priceValidUntil: body.priceValidUntil !== undefined ? (body.priceValidUntil ? new Date(body.priceValidUntil) : null) : product.priceValidUntil,
        leadTimeDays: body.leadTimeDays !== undefined ? toLeadTimeDays(body.leadTimeDays) : product.leadTimeDays,
        isActive: body.isActive !== undefined ? body.isActive : product.isActive,
        notes: body.notes !== undefined ? body.notes?.trim() || null : product.notes,
      },
    });

    await logAudit({
      branchId: branchFilter.branchId ?? product.branchId,
      action: "UPDATE",
      entity: "product",
      entityId: product.id,
      details: { name: updated.name },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const { id } = await params;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (branchFilter.branchId && product.branchId !== branchFilter.branchId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.product.delete({ where: { id } });
    await logAudit({ branchId: branchFilter.branchId ?? product.branchId, action: "DELETE", entity: "product", entityId: id, details: { name: product.name } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isForeignKeyError(error)) {
      return NextResponse.json(
        { error: "Cannot delete this product while related records still reference it." },
        { status: 409 }
      );
    }
    console.error("Error deleting product:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
