import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "HEAD_ADMIN") {
      return NextResponse.json({ error: "Only Head Admin can switch branches" }, { status: 403 });
    }

    const { branchId } = await request.json();

    if (branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) {
        return NextResponse.json({ error: "Branch not found" }, { status: 404 });
      }
    }

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
