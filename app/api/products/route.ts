import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/prisma/client/client";
import { getBranchFilter, requireAuth, requireBranchId } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { parseOr400, readJson } from "@/lib/validations";
import { productCreateSchema, toLeadTimeDays } from "@/lib/validations/product";

export async function GET(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const active = searchParams.get("active") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = { ...branchFilter };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { brand: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { model: { contains: search, mode: Prisma.QueryMode.insensitive } },
      ];
    }
    if (category) where.category = category;
    if (active === "true") where.isActive = true;
    if (active === "false") where.isActive = false;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({ data: products, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchId = await requireBranchId();

    const parsed = parseOr400(productCreateSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const product = await prisma.product.create({
      data: {
        branchId,
        name: body.name.trim(),
        category: body.category || null,
        brand: body.brand || null,
        model: body.model || null,
        unit: body.unit || null,
        sellPrice: body.sellPrice ? Number(body.sellPrice) : null,
        currency: body.currency || "PHP",
        priceValidUntil: body.priceValidUntil ? new Date(body.priceValidUntil) : null,
        leadTimeDays: toLeadTimeDays(body.leadTimeDays),
        isActive: body.isActive ?? true,
        notes: body.notes?.trim() || null,
      },
    });

    await logAudit({
      branchId,
      action: "CREATE",
      entity: "product",
      entityId: product.id,
      details: { name: product.name, category: product.category },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
