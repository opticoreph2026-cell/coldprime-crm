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
    const companyId = searchParams.get("companyId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const where: Prisma.ProjectWhereInput = { ...branchFilter };
    if (search) {
      where.OR = [
        { projectName: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { company: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } },
        { projectLocation: { contains: search, mode: Prisma.QueryMode.insensitive } },
      ];
    }
    if (status) where.status = status;
    if (companyId) where.companyId = companyId;

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          company: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.project.count({ where }),
    ]);

    return NextResponse.json({
      data: projects,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const body = await request.json();
    const {
      companyId, projectName, projectLocation, projectType, status,
      contactId, assignedTo, source, quotationDate, startDate, targetCompletion,
      installationStatus, testingStatus, commissioningStatus, remarks,
    } = body;

    if (!companyId || !projectName?.trim()) {
      return NextResponse.json({ error: "Company and project name are required" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        ...branchFilter,
        companyId,
        projectName: projectName.trim(),
        projectLocation: projectLocation?.trim() || null,
        projectType: projectType?.trim() || null,
        status: status || "Quotation",
        contactId: contactId || null,
        assignedTo: assignedTo?.trim() || null,
        source: source?.trim() || null,
        quotationDate: quotationDate ? new Date(quotationDate) : null,
        startDate: startDate ? new Date(startDate) : null,
        targetCompletion: targetCompletion ? new Date(targetCompletion) : null,
        installationStatus: installationStatus || null,
        testingStatus: testingStatus || null,
        commissioningStatus: commissioningStatus || null,
        remarks: remarks?.trim() || null,
      },
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
