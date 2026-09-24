import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/prisma/client/client";
import { getBranchFilter, requireAuth, requireBranchId } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { isValidStatus } from "@/lib/status";

export async function GET(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const outreach = searchParams.get("outreach") || "";
    const industry = searchParams.get("industry") || "";
    const source = searchParams.get("source") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const where: Prisma.CompanyWhereInput = { ...branchFilter };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { mobile1: { contains: search } },
        { mobile2: { contains: search } },
        { mobile3: { contains: search } },
        { landline1: { contains: search } },
        { landline2: { contains: search } },
        { landline3: { contains: search } },
        { address: { contains: search, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    if (status) where.status = status;
    if (outreach === "NONE") where.outreachStatus = null;
    else if (outreach) where.outreachStatus = outreach;
    if (industry) where.industry = industry;
    if (source) where.source = source;

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        include: {
          contacts: { select: { id: true } },
          projects: { select: { id: true, status: true } },
          _count: { select: { activities: true, leads: true } },
        },
        orderBy: { name: "asc" },
        skip: offset,
        take: limit,
      }),
      prisma.company.count({ where }),
    ]);

    return NextResponse.json({
      data: companies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching companies:", error);
    return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchId = await requireBranchId();

    const body = await request.json();
    const { name, industry, address, website, email, mobile1, mobile2, mobile3, landline1, landline2, landline3, status, notes, source } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    if (status && !(await isValidStatus(branchId, "company", status))) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }
    if (industry && !(await isValidStatus(branchId, "industry", industry))) {
      return NextResponse.json({ error: `Invalid industry: ${industry}` }, { status: 400 });
    }

    const allPhones = [mobile1, mobile2, mobile3, landline1, landline2, landline3].filter(Boolean).map((p: string) => p.trim());

    const existing = await prisma.company.findFirst({
      where: {
        OR: [
          { name: { equals: name.trim(), mode: Prisma.QueryMode.insensitive } },
          ...(email ? [{ email: { equals: email.trim(), mode: Prisma.QueryMode.insensitive } }] : []),
          ...(allPhones.length > 0 ? allPhones.map((p: string) => ({ OR: [
            { mobile1: p }, { mobile2: p }, { mobile3: p },
            { landline1: p }, { landline2: p }, { landline3: p },
          ]})) : []),
        ],
        branchId,
      },
    });

    if (existing) {
      return NextResponse.json({
        error: "Possible duplicate found",
        duplicate: {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          mobile1: existing.mobile1,
          landline1: existing.landline1,
        },
      }, { status: 409 });
    }

    const company = await prisma.company.create({
      data: {
        branchId,
        name: name.trim(),
        industry: industry || "Other",
        address: address?.trim() || null,
        website: website?.trim() || null,
        email: email?.trim() || null,
        mobile1: mobile1?.trim() || null,
        mobile2: mobile2?.trim() || null,
        mobile3: mobile3?.trim() || null,
        landline1: landline1?.trim() || null,
        landline2: landline2?.trim() || null,
        landline3: landline3?.trim() || null,
        status: status || "Active",
        notes: notes?.trim() || null,
        source: source?.trim() || null,
      },
    });

    await logAudit({ branchId, action: "CREATE", entity: "Company", entityId: company.id, details: { name: name.trim(), industry } });

    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    console.error("Error creating company:", error);
    return NextResponse.json({ error: "Failed to create company" }, { status: 500 });
  }
}