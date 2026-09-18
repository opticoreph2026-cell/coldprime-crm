import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth, requireBranchId } from "@/lib/branch";

export async function GET() {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const statuses = await prisma.statusDefinition.findMany({
      where: { ...branchFilter, isActive: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(statuses);
  } catch (error) {
    console.error("Error fetching status definitions:", error);
    return NextResponse.json(
      { error: "Failed to fetch status definitions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchId = await requireBranchId();

    const body = await request.json();
    const { name, type } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      );
    }

    const status = await prisma.statusDefinition.upsert({
      where: { branchId_name_type: { branchId, name, type } },
      update: { isActive: true },
      create: { branchId, name, type, isActive: true },
    });

    return NextResponse.json(status, { status: 201 });
  } catch (error) {
    console.error("Error creating status definition:", error);
    return NextResponse.json(
      { error: "Failed to create status definition" },
      { status: 500 }
    );
  }
}
