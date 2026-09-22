import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";

export async function GET() {
  try {
    let session;
    try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const logs = await prisma.emailLog.findMany({
      where: { ...branchFilter },
      include: { template: { select: { name: true, subject: true } }, fromUser: { select: { name: true } } },
      orderBy: { sentAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ data: logs });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "No branch assigned") return NextResponse.json({ error: "No branch assigned" }, { status: 400 });
    console.error("Error fetching logs:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
