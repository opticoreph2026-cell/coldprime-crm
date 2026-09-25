import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth, requireBranchId, requireRole } from "@/lib/branch";
import { parseOr400, readJson } from "@/lib/validations";
import { statusDefinitionCreateSchema } from "@/lib/validations/status-definition";

export async function GET(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const url = new URL(request.url);
    const type = url.searchParams.get("type") || undefined;
    const includeInactive = url.searchParams.get("all") === "1";
    const statuses = await prisma.statusDefinition.findMany({
      where: { ...branchFilter, ...(includeInactive ? {} : { isActive: true }), ...(type && { type }) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
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
    try { await requireRole(["HEAD_ADMIN", "BRANCH_ADMIN"]); } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const branchId = await requireBranchId();

    const parsed = parseOr400(statusDefinitionCreateSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const { name, type } = parsed.data;

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
