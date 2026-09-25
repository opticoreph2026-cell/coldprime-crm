import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CompanyType, AccreditationStatus } from "@/lib/prisma/client/client";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { isValidStatus } from "@/lib/status";
import { isCompanyType, isAccreditationStatus } from "@/lib/enums";
import { parseOr400, readJson } from "@/lib/validations";
import { companyUpdateSchema } from "@/lib/validations/company";
import { isForeignKeyError } from "@/lib/prisma-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { id } = await params;
    const company = await prisma.company.findFirst({
      where: { id, ...branchFilter },
      include: {
        contacts: { orderBy: { firstName: "asc" } },
        projects: { orderBy: { createdAt: "desc" } },
        activities: { orderBy: { date: "desc" }, take: 50 },
        leads: { orderBy: { createdAt: "desc" } },
        documents: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error("Error fetching company:", error);
    return NextResponse.json({ error: "Failed to fetch company" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { id } = await params;
    const parsed = parseOr400(companyUpdateSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const { name, industry, type, accreditationStatus, accreditationSubmittedAt, accreditationDecisionAt, address, website, email, mobile1, mobile2, mobile3, landline1, landline2, landline3, status, notes, source } = body;

    const existing = await prisma.company.findFirst({ where: { id, ...branchFilter } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (type !== undefined && !isCompanyType(type)) {
      return NextResponse.json({ error: `Invalid company type: ${type}` }, { status: 400 });
    }
    if (accreditationStatus !== undefined && !isAccreditationStatus(accreditationStatus)) {
      return NextResponse.json({ error: `Invalid accreditation status: ${accreditationStatus}` }, { status: 400 });
    }

    // Auto-maintain accreditation timestamps on status transitions
    let submittedAt = existing.accreditationSubmittedAt;
    let decisionAt = existing.accreditationDecisionAt;
    if (accreditationStatus !== undefined && accreditationStatus !== existing.accreditationStatus) {
      const now = new Date();
      if ((accreditationStatus === "DOCUMENTS_SUBMITTED" || accreditationStatus === "UNDER_REVIEW") && !submittedAt) {
        submittedAt = now;
      }
      if ((accreditationStatus === "ACCREDITED" || accreditationStatus === "REJECTED")) {
        decisionAt = now;
      }
      if (accreditationStatus === "NOT_STARTED") {
        submittedAt = null;
        decisionAt = null;
      }
    }

    if (status !== undefined && status && !(await isValidStatus(existing.branchId, "company", status))) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }
    if (industry !== undefined && industry && !(await isValidStatus(existing.branchId, "industry", industry))) {
      return NextResponse.json({ error: `Invalid industry: ${industry}` }, { status: 400 });
    }

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(type !== undefined && { type: type as CompanyType }),
        ...(accreditationStatus !== undefined && { accreditationStatus: accreditationStatus as AccreditationStatus }),
        ...(accreditationStatus !== undefined && {
          accreditationSubmittedAt: accreditationSubmittedAt !== undefined ? (accreditationSubmittedAt ? new Date(accreditationSubmittedAt) : null) : submittedAt,
          accreditationDecisionAt: accreditationDecisionAt !== undefined ? (accreditationDecisionAt ? new Date(accreditationDecisionAt) : null) : decisionAt,
        }),
        ...(industry !== undefined && { industry }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(website !== undefined && { website: website?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(mobile1 !== undefined && { mobile1: mobile1?.trim() || null }),
        ...(mobile2 !== undefined && { mobile2: mobile2?.trim() || null }),
        ...(mobile3 !== undefined && { mobile3: mobile3?.trim() || null }),
        ...(landline1 !== undefined && { landline1: landline1?.trim() || null }),
        ...(landline2 !== undefined && { landline2: landline2?.trim() || null }),
        ...(landline3 !== undefined && { landline3: landline3?.trim() || null }),
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(source !== undefined && { source: source?.trim() || null }),
      },
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error("Error updating company:", error);
    return NextResponse.json({ error: "Failed to update company" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { id } = await params;
    const existing = await prisma.company.findFirst({ where: { id, ...branchFilter } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.company.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isForeignKeyError(error)) {
      return NextResponse.json(
        { error: "Cannot delete this company while related records still reference it. Delete its contacts, projects, and documents first." },
        { status: 409 }
      );
    }
    console.error("Error deleting company:", error);
    return NextResponse.json({ error: "Failed to delete company" }, { status: 500 });
  }
}