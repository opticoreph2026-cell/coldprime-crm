import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseOr400, readJson } from "@/lib/validations";
import { branchSwitchSchema } from "@/lib/validations/user";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "HEAD_ADMIN") {
      return NextResponse.json({ error: "Only Head Admin can switch branches" }, { status: 403 });
    }

    const parsed = parseOr400(branchSwitchSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const branchId = parsed.data.branchId || null;

    if (branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) {
        return NextResponse.json({ error: "Branch not found" }, { status: 404 });
      }
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { activeBranchId: branchId || null },
    });

    return NextResponse.json({
      success: true,
      activeBranchId: branchId || null,
      message: branchId ? "Branch switched" : "Showing all branches",
    });
  } catch (error) {
    console.error("Error switching branch:", error);
    return NextResponse.json({ error: "Failed to switch branch" }, { status: 500 });
  }
}
