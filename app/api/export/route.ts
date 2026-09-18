import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exportCustomerDatabase, exportProjectReport, exportActivityReport, type ExportCompany, type ExportProject, type ExportActivity } from "@/lib/excel/export";
import { getBranchFilter, requireAuth } from "@/lib/branch";

export async function GET(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "customers";

    let buffer: Buffer;

    switch (type) {
      case "customers": {
        const companies = await prisma.company.findMany({
          where: branchFilter,
          include: {
            contacts: { take: 1, orderBy: { firstName: "asc" } },
            projects: { select: { id: true } },
          },
          orderBy: { name: "asc" },
        });

        const exportData: ExportCompany[] = companies.map((c) => ({
          date: c.createdAt,
          company: c.name,
          industry: c.industry,
          email: c.email || undefined,
          phone: c.phone || undefined,
          address: c.address || undefined,
          website: c.website || undefined,
          contactPerson: c.contacts[0]
            ? `${c.contacts[0].firstName} ${c.contacts[0].lastName || ""}`.trim()
            : undefined,
          position: c.contacts[0]?.position || undefined,
          status: c.status,
          remarks: c.notes || undefined,
        }));

        buffer = await exportCustomerDatabase(exportData);
        break;
      }

      case "projects": {
        const projects = await prisma.project.findMany({
          where: branchFilter,
          include: { company: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        });

        const projectData: (ExportProject & { company?: string })[] = projects.map((p) => ({
          company: p.company.name,
          projectName: p.projectName,
          status: p.status,
          projectLocation: p.projectLocation || undefined,
          projectType: p.projectType || undefined,
          startDate: p.startDate,
          targetCompletion: p.targetCompletion,
          actualCompletion: p.actualCompletion,
          installationStatus: p.installationStatus || undefined,
          testingStatus: p.testingStatus || undefined,
          commissioningStatus: p.commissioningStatus || undefined,
          remarks: p.remarks || undefined,
        }));

        buffer = await exportProjectReport(projectData);
        break;
      }

      case "activities": {
        const activities = await prisma.activity.findMany({
          where: branchFilter,
          include: {
            company: { select: { name: true } },
          },
          orderBy: { date: "desc" },
          take: 1000,
        });

        const activityData: ExportActivity[] = activities.map((a) => ({
          date: a.date,
          type: a.type,
          company: a.company?.name,
          contactPerson: a.contactPerson || undefined,
          description: a.description || undefined,
          result: a.result || undefined,
          nextAction: a.nextAction || undefined,
          nextFollowUp: a.nextFollowUp,
        }));

        buffer = await exportActivityReport(activityData);
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
    }

    const filename = `Coldprime_CRM_${type}_${new Date().toISOString().split("T")[0]}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
