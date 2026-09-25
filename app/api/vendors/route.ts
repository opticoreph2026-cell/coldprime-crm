import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/prisma/client/client";
import { getBranchFilter, requireAuth, requireBranchId } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { parseOr400, readJson } from "@/lib/validations";
import { vendorCreateSchema } from "@/lib/validations/vendor";

export async function GET(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const where: Prisma.VendorWhereInput = { ...branchFilter };
    if (search) {
      where.name = { contains: search, mode: Prisma.QueryMode.insensitive };
    }
    if (category) where.category = category;
    if (status) where.status = status;

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          contacts: { select: { id: true, firstName: true, lastName: true, position: true } },
          materials: { select: { id: true, itemName: true, category: true, unitPrice: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.vendor.count({ where }),
    ]);

    return NextResponse.json({ data: vendors, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchId = await requireBranchId();

    const parsed = parseOr400(vendorCreateSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const { name, category, address, website, email, mobile1, mobile2, landline1, landline2, status, notes } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Vendor name is required" }, { status: 400 });
    }

    const vendor = await prisma.vendor.create({
      data: {
        branchId,
        name: name.trim(),
        category: category || null,
        address: address?.trim() || null,
        website: website?.trim() || null,
        email: email?.trim() || null,
        mobile1: mobile1?.trim() || null,
        mobile2: mobile2?.trim() || null,
        landline1: landline1?.trim() || null,
        landline2: landline2?.trim() || null,
        status: status || "Active",
        notes: notes?.trim() || null,
      },
      include: { branch: { select: { id: true, name: true, slug: true } } },
    });

    await logAudit({ branchId, action: "CREATE", entity: "Vendor", entityId: vendor.id, details: { name: vendor.name, category } });

    return NextResponse.json(vendor, { status: 201 });
  } catch (error) {
    console.error("Error creating vendor:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
