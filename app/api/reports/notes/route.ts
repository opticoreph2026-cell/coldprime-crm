// PUT /api/reports/notes - save the signed-in user's weekly narrative
// (highlights / blockers) for a single week (master instructions 1.9).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/branch";
import { parseOr400, readJson } from "@/lib/validations";
import { reportNoteSchema } from "@/lib/validations/report";
import { mondayOf, startOfDayPH } from "@/lib/dates";

export async function PUT(request: Request) {
  try {
    let session;
    try {
      session = await requireAuth();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = parseOr400(reportNoteSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const { weekStart, highlights, blockers } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id as string },
      select: { branchId: true, activeBranchId: true },
    });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const branchId = user.activeBranchId || user.branchId;
    if (!branchId) {
      return NextResponse.json({ error: "No branch assigned - please select a branch first" }, { status: 400 });
    }

    // Notes are always stored against Monday 00:00 Asia/Manila.
    const weekStartAt = startOfDayPH(mondayOf(weekStart));
    const data = {
      highlights: highlights?.trim() || null,
      blockers: blockers?.trim() || null,
    };

    const note = await prisma.weeklyReportNote.upsert({
      where: { userId_weekStart: { userId: session.user.id as string, weekStart: weekStartAt } },
      create: {
        userId: session.user.id as string,
        branchId,
        weekStart: weekStartAt,
        ...data,
      },
      update: data,
    });

    return NextResponse.json(note);
  } catch (error) {
    console.error("Error saving report note:", error);
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }
}
