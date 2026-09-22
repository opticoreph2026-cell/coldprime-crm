import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/branch";

export async function GET() {
  try {
    await requireAuth();
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data: branches });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Error fetching branches:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
