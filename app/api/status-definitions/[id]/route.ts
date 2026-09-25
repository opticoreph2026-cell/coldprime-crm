import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, requireBranchId } from "@/lib/branch";
import { parseOr400, readJson } from "@/lib/validations";
import { statusDefinitionUpdateSchema } from "@/lib/validations/status-definition";

async function requireAdmin() {
  try {
    await requireRole(["HEAD_ADMIN", "BRANCH_ADMIN"]);
    return null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// Where each status type's records keep their value (branch-scoped cascade on rename)
const RENAME_TARGETS: Record<string, [string, string]> = {
  company: ["companies", "status"],
  lead: ["leads", "status"],
  project: ["projects", "status"],
  activity: ["activities", "type"],
  industry: ["companies", "industry"],
};

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin();
  if (authError) return authError;
  try {
    const branchId = await requireBranchId();
    const { id } = await params;

    const parsed = parseOr400(statusDefinitionUpdateSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const { name, isActive } = parsed.data;
    if (name === undefined && isActive === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const existing = await prisma.statusDefinition.findUnique({ where: { id } });
    if (!existing || existing.branchId !== branchId) {
      return NextResponse.json({ error: "Status not found" }, { status: 404 });
    }

    if (name !== undefined && name !== existing.name) {
      const clash = await prisma.statusDefinition.findUnique({
        where: { branchId_name_type: { branchId, name, type: existing.type } },
      });
      if (clash) {
        return NextResponse.json({ error: `"${name}" already exists in this group` }, { status: 409 });
      }
      const target = RENAME_TARGETS[existing.type];
      if (target) {
        const [table, column] = target;
        await prisma.$executeRawUnsafe(
          `UPDATE ${table} SET ${column} = $1 WHERE ${column} = $2 AND branch_id = $3`,
          name, existing.name, branchId
        );
      }
    }

    const updated = await prisma.statusDefinition.update({
      where: { id },
      data: { ...(name !== undefined && { name }), ...(isActive !== undefined && { isActive }) },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating status definition:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin();
  if (authError) return authError;
  try {
    const branchId = await requireBranchId();
    const { id } = await params;

    const existing = await prisma.statusDefinition.findUnique({ where: { id } });
    if (!existing || existing.branchId !== branchId) {
      return NextResponse.json({ error: "Status not found" }, { status: 404 });
    }

    const updated = await prisma.statusDefinition.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error deactivating status definition:", error);
    return NextResponse.json({ error: "Failed to deactivate status" }, { status: 500 });
  }
}
