import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { getViewerRole } from "@/lib/cost";

export async function GET(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { searchParams } = new URL(request.url);
    const wantDeleted = searchParams.get("deleted") === "true";
    const status = searchParams.get("status") || "";
    const search = searchParams.get("search") || "";

    // "Deleted emails" filter is admin-only (Phase 3).
    if (wantDeleted) {
      const role = await getViewerRole();
      if (role !== "BRANCH_ADMIN" && role !== "HEAD_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const where: Record<string, unknown> = { ...branchFilter };
    where.deletedAt = wantDeleted ? { not: null } : null;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { toEmail: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
      ];
    }

    const logs = await prisma.emailLog.findMany({
      where,
      include: { template: { select: { name: true, subject: true } }, fromUser: { select: { name: true } } },
      orderBy: { sentAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ data: logs, deletedFilter: wantDeleted });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "No branch assigned") return NextResponse.json({ error: "No branch assigned" }, { status: 400 });
    console.error("Error fetching logs:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
