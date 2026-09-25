import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, LeadType } from "@/lib/prisma/client/client";
import { getBranchFilter, requireAuth, requireBranchId } from "@/lib/branch";
import { isValidStatus } from "@/lib/status";
import { isLeadType } from "@/lib/enums";

export async function GET(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const type = searchParams.get("type") || "";
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
    if (type) where.type = type as LeadType;

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
    const branchId = await requireBranchId();

    const body = await request.json();
    const { companyId, contactId, source, industry, type, status, priority, estimatedValue, assignedTo, notes } = body;

    if (type !== undefined && !isLeadType(type)) {
      return NextResponse.json({ error: `Invalid lead type: ${type}` }, { status: 400 });
    }
    if (status !== undefined && !(await isValidStatus(branchId, "lead", status))) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    // Verify company belongs to same branch
    if (companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { branchId: true },
      });
      if (!company || company.branchId !== branchId) {
        return NextResponse.json({ error: "Company not found in your branch" }, { status: 400 });
      }
    }

    // Verify contact belongs to same branch
    if (contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { branchId: true },
      });
      if (!contact || contact.branchId !== branchId) {
        return NextResponse.json({ error: "Contact not found in your branch" }, { status: 400 });
      }
    }

    const lead = await prisma.lead.create({
      data: {
        branchId,
        companyId: companyId || null,
        contactId: contactId || null,
        source: source?.trim() || null,
        industry: industry || null,
        ...(type && { type: type as LeadType }),
        status: status || "New",
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

