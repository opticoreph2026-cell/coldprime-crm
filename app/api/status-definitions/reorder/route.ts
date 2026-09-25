import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, requireBranchId } from "@/lib/branch";
import { parseOr400, readJson } from "@/lib/validations";
import { statusReorderSchema } from "@/lib/validations/status-definition";

export async function PUT(request: Request) {
  try {
    try { await requireRole(["HEAD_ADMIN", "BRANCH_ADMIN"]); } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const branchId = await requireBranchId();

    const parsed = parseOr400(statusReorderSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const { type, ids } = parsed.data;

    const rows = await prisma.statusDefinition.findMany({
      where: { branchId, type },
      select: { id: true },
    });
    const valid = new Set(rows.map((r) => r.id));
    if (ids.length !== rows.length || ids.some((id) => !valid.has(id))) {
      return NextResponse.json({ error: "Order does not match current statuses" }, { status: 409 });
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.statusDefinition.update({ where: { id }, data: { sortOrder: index } })
      )
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error reordering status definitions:", error);
    return NextResponse.json({ error: "Failed to reorder statuses" }, { status: 500 });
  }
}
