// GET /api/reports/weekly - weekly accomplishment report (master instructions 1.6).
// Access rules:
//   STAFF       -> always their own data (any other userId is ignored)
//   BRANCH_ADMIN -> any user in their branch, or the whole branch
//   HEAD_ADMIN  -> respects the active branch (All Branches allowed)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { parseOr400 } from "@/lib/validations";
import { weeklyReportQuerySchema } from "@/lib/validations/report";
import { buildWeeklyReport } from "@/lib/reports/weekly";
import { buildWeeklyXlsx, weeklyXlsxFilename } from "@/lib/reports/weekly-xlsx";
import { buildWeeklyPdf, weeklyPdfFilename } from "@/lib/reports/weekly-pdf";
import { currentWeekRange, validateRange } from "@/lib/dates";

export async function GET(request: Request) {
  try {
    let session;
    try {
      session = await requireAuth();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const branchFilter = await getBranchFilter();

    const { searchParams } = new URL(request.url);
    const parsed = parseOr400(weeklyReportQuerySchema, Object.fromEntries(searchParams));
    if (!parsed.ok) return parsed.response;
    const { userId, format } = parsed.data;

    const current = currentWeekRange();
    const from = parsed.data.from || current.from;
    const to = parsed.data.to || current.to;

    const rangeError = validateRange(from, to);
    if (rangeError) return NextResponse.json({ error: rangeError }, { status: 400 });

    const me = await prisma.user.findUnique({
      where: { id: session.user.id as string },
      select: { role: true, branchId: true, activeBranchId: true },
    });
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let scopeUserId: string | null = null;
    if (me.role === "STAFF") {
      scopeUserId = session.user.id as string; // staff always get their own data
    } else if (userId) {
      if (userId !== (session.user.id as string)) {
        const target = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, branchId: true },
        });
        if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
        if (me.role === "BRANCH_ADMIN") {
          const myBranch = me.activeBranchId || me.branchId;
          if (!myBranch || target.branchId !== myBranch) {
            return NextResponse.json({ error: "User is not in your branch" }, { status: 403 });
          }
        }
      }
      scopeUserId = userId;
    }

    const report = await buildWeeklyReport({
      branchFilter,
      userId: scopeUserId,
      viewerUserId: session.user.id as string,
      from,
      to,
    });

    if (format === "xlsx") {
      const buffer = await buildWeeklyXlsx(report);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${weeklyXlsxFilename(report)}"`,
        },
      });
    }

    if (format === "pdf") {
      const doc = buildWeeklyPdf(report);
      const buffer = doc.output("arraybuffer");
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${weeklyPdfFilename(report)}"`,
        },
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error building weekly report:", error);
    return NextResponse.json({ error: "Failed to build report" }, { status: 500 });
  }
}
