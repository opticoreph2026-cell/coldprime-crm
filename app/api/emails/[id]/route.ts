// DELETE /api/emails/[id] - soft delete (hidden from UI, kept for audit and
// opt-out history). ?purge=true permanently removes rows that are already
// soft-deleted (admins only).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { getViewerRole } from "@/lib/cost";
import { logAudit } from "@/lib/audit";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    let session;
    try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const { id } = await params;

    const purge = new URL(request.url).searchParams.get("purge") === "true";

    const log = await prisma.emailLog.findUnique({ where: { id } });
    if (!log) return NextResponse.json({ error: "Email not found" }, { status: 404 });
    if (branchFilter.branchId && log.branchId !== branchFilter.branchId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (purge) {
      const role = await getViewerRole();
      if (role !== "BRANCH_ADMIN" && role !== "HEAD_ADMIN") {
        return NextResponse.json({ error: "Only admins can purge emails" }, { status: 403 });
      }
      if (!log.deletedAt) {
        return NextResponse.json({ error: "Delete the email first, then purge it" }, { status: 400 });
      }
      await prisma.emailLog.delete({ where: { id } });
      await logAudit({
        userId: session.user.id,
        branchId: log.branchId,
        action: "DELETE",
        entity: "email",
        entityId: id,
        details: { label: log.subject, purged: true },
      });
      return NextResponse.json({ success: true, purged: true });
    }

    await prisma.emailLog.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await logAudit({
      userId: session.user.id,
      branchId: log.branchId,
      action: "DELETE",
      entity: "email",
      entityId: id,
      details: { label: log.subject },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting email:", error);
    return NextResponse.json({ error: "Failed to delete email" }, { status: 500 });
  }
}
