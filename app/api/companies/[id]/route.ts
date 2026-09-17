import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: { firstName: "asc" } },
        projects: { orderBy: { createdAt: "desc" } },
        activities: { orderBy: { date: "desc" }, take: 50 },
        leads: { orderBy: { createdAt: "desc" } },
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
    const { id } = await params;
    const body = await request.json();
    const { name, industry, address, website, email, phone, status, notes, source } = body;

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(industry !== undefined && { industry }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(website !== undefined && { website: website?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
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
    const { id } = await params;
    await prisma.company.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting company:", error);
    return NextResponse.json({ error: "Failed to delete company" }, { status: 500 });
  }
}