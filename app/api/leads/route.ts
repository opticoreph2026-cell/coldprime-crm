import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/prisma/client/client";
import { getBranchFilter, requireAuth } from "@/lib/branch";

export async function GET(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const where: Prisma.LeadWhereInput = { ...branchFilter };
    if (search) {
      where.OR = [
        { company: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } },
        { notes: { contains: search, mode: Prisma.QueryMode.insensitive } },
      ];
    }
    if (status) where.status = status;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          company: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { dateAdded: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json({
      data: leads,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const body = await request.json();
    const { companyId, contactId, source, industry, priority, estimatedValue, assignedTo, notes } = body;

    const lead = await prisma.lead.create({
      data: {
        ...branchFilter,
        companyId: companyId || null,
        contactId: contactId || null,
        source: source?.trim() || null,
        industry: industry || null,
        status: "New",
        priority: priority || "Medium",
        estimatedValue: estimatedValue ? Number(estimatedValue) : null,
        assignedTo: assignedTo?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error("Error creating lead:", error);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
