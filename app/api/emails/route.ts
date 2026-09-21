import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const branchFilter = await getBranchFilter();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId") || "";
    const search = searchParams.get("search") || "";

    const where: any = { ...branchFilter };
    if (companyId) where.companyId = companyId;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search } },
      ];
    }
    where.email = { not: null };

    const contacts = await prisma.contact.findMany({
      where,
      include: { company: { select: { id: true, name: true, industry: true } } },
    });

    const companies = await prisma.company.findMany({
      where: { ...branchFilter, email: { not: null } },
      select: { id: true, name: true, email: true, industry: true },
    });

    return NextResponse.json({ contacts, companies });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "No branch assigned") return NextResponse.json({ error: "No branch assigned" }, { status: 400 });
    console.error("Error fetching recipients:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
