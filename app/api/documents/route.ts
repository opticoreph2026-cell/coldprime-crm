import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/prisma/client/client";
import { getBranchFilter, requireAuth, requireBranchId } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { parseOr400, readJson } from "@/lib/validations";
import { documentCreateSchema } from "@/lib/validations/document";

// Verify an optional parent reference exists in the caller's branch
async function verifyParent(branchId: string, field: "companyId" | "leadId" | "projectId" | "vendorId", id: string) {
  const model = field === "companyId" ? prisma.company
    : field === "leadId" ? prisma.lead
    : field === "projectId" ? prisma.project
    : prisma.vendor;
  const rec = await (model as { findUnique: (args: object) => Promise<{ branchId: string } | null> }).findUnique({
    where: { id },
    select: { branchId: true },
  });
  return rec && rec.branchId === branchId;
}

export async function GET(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId") || undefined;
    const leadId = searchParams.get("leadId") || undefined;
    const projectId = searchParams.get("projectId") || undefined;
    const vendorId = searchParams.get("vendorId") || undefined;
    const category = searchParams.get("category") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const where: Prisma.DocumentWhereInput = {
      ...branchFilter,
      ...(companyId && { companyId }),
      ...(leadId && { leadId }),
      ...(projectId && { projectId }),
      ...(vendorId && { vendorId }),
      ...(category && { category }),
    };

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          company: { select: { id: true, name: true } },
          lead: { select: { id: true, status: true } },
          project: { select: { id: true, projectName: true } },
          vendor: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.document.count({ where }),
    ]);

    return NextResponse.json({
      data: documents,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchId = await requireBranchId();

    const parsed = parseOr400(documentCreateSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const { category, fileName, fileUrl, companyId, leadId, projectId, vendorId } = body;

    if (companyId && !(await verifyParent(branchId, "companyId", companyId))) {
      return NextResponse.json({ error: "Company not found in your branch" }, { status: 400 });
    }
    if (leadId && !(await verifyParent(branchId, "leadId", leadId))) {
      return NextResponse.json({ error: "Lead not found in your branch" }, { status: 400 });
    }
    if (projectId && !(await verifyParent(branchId, "projectId", projectId))) {
      return NextResponse.json({ error: "Project not found in your branch" }, { status: 400 });
    }
    if (vendorId && !(await verifyParent(branchId, "vendorId", vendorId))) {
      return NextResponse.json({ error: "Vendor not found in your branch" }, { status: 400 });
    }

    const document = await prisma.document.create({
      data: {
        branchId,
        category,
        fileName: fileName.trim(),
        fileUrl: fileUrl.trim(),
        companyId: companyId || null,
        leadId: leadId || null,
        projectId: projectId || null,
        vendorId: vendorId || null,
      },
    });

    await logAudit({ branchId, action: "CREATE", entity: "Document", entityId: document.id, details: { fileName, category } });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Error creating document:", error);
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
  }
}
