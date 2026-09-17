import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const companyId = searchParams.get("companyId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
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
    const body = await request.json();
    const { companyId, firstName, lastName, position, email, mobile, landline, contactPreference, notes } = body;

    if (!firstName?.trim() || !companyId) {
      return NextResponse.json({ error: "First name and company are required" }, { status: 400 });
    }

    const contact = await prisma.contact.create({
      data: {
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