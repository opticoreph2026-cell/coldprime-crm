import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/prisma/client/client";
import { getBranchFilter, requireAuth, requireBranchId } from "@/lib/branch";
import { parseOr400, readJson } from "@/lib/validations";
import { contactCreateSchema } from "@/lib/validations/contact";

export async function GET(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const companyId = searchParams.get("companyId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const where: Prisma.ContactWhereInput = { ...branchFilter };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { lastName: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { mobile: { contains: search } },
      ];
    }

    if (companyId) where.companyId = companyId;

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: { company: { select: { id: true, name: true } } },
        orderBy: { firstName: "asc" },
        skip: offset,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ]);

    return NextResponse.json({
      data: contacts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchId = await requireBranchId();

    const parsed = parseOr400(contactCreateSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const { companyId, firstName, lastName, position, email, mobile, landline, contactPreference, notes } = body;

    if (!firstName?.trim() || !companyId) {
      return NextResponse.json({ error: "First name and company are required" }, { status: 400 });
    }

    const company = await prisma.company.findFirst({
      where: { id: companyId, branchId },
      select: { id: true },
    });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const contact = await prisma.contact.create({
      data: {
        branchId,
        companyId,
        firstName: firstName.trim(),
        lastName: lastName?.trim() || null,
        position: position?.trim() || null,
        email: email?.trim() || null,
        mobile: mobile?.trim() || null,
        landline: landline?.trim() || null,
        contactPreference: contactPreference || null,
        notes: notes?.trim() || null,
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("Error creating contact:", error);
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}