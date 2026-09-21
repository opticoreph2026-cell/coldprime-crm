import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const branchFilter = await getBranchFilter();
    const logs = await prisma.emailLog.findMany({
      where: { ...branchFilter },
      include: { template: { select: { name: true, subject: true } }, fromUser: { select: { name: true } } },
      orderBy: { sentAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ data: logs });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "No branch assigned") return NextResponse.json({ error: "No branch assigned" }, { status: 400 });
    console.error("Error fetching logs:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
