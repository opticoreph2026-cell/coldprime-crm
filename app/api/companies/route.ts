import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "../prisma/client/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const industry = searchParams.get("industry") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const where: Prisma.CompanyWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { phone: { contains: search } },
        { address: { contains: search, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    if (status) where.status = status;
    if (industry) where.industry = industry;

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
    const body = await request.json();
    const { name, industry, address, website, email, phone, status, notes, source } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    const existing = await prisma.company.findFirst({
      where: {
        OR: [
          { name: { equals: name.trim(), mode: Prisma.QueryMode.insensitive } },
          ...(email ? [{ email: { equals: email.trim(), mode: Prisma.QueryMode.insensitive } }] : []),
          ...(phone ? [{ phone: phone.trim() }] : []),
        ],
      },
    });

    if (existing) {
      return NextResponse.json({
        error: "Possible duplicate found",
        duplicate: {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          phone: existing.phone,
        },
      }, { status: 409 });
    }

    const company = await prisma.company.create({
      data: {
        name: name.trim(),
        industry: industry || "Other",
        address: address?.trim() || null,
        website: website?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        status: status || "Active",
        notes: notes?.trim() || null,
        source: source?.trim() || null,
      },
    });

    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    console.error("Error creating company:", error);
    return NextResponse.json({ error: "Failed to create company" }, { status: 500 });
  }
}