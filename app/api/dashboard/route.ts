import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";

export async function GET() {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 6);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalCompanies,
      totalContacts,
      totalLeads,
      totalProjects,
      activeLeads,
      activeProjects,
      upcomingFollowUps,
      overdueFollowUps,
      activitiesThisMonth,
      newLeadsThisMonth,
      projectsByStatus,
    ] = await Promise.all([
      prisma.company.count({ where: branchFilter }),
      prisma.contact.count({ where: branchFilter }),
      prisma.lead.count({ where: branchFilter }),
      prisma.project.count({ where: branchFilter }),
      prisma.lead.count({ where: { ...branchFilter, status: { notIn: ["Completed", "Cancelled", "Declined"] } } }),
      prisma.project.count({ where: { ...branchFilter, status: { notIn: ["Completed", "Cancelled"] } } }),
      prisma.activity.count({
        where: {
          ...branchFilter,
          nextFollowUp: { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.activity.count({
        where: {
          ...branchFilter,
          nextFollowUp: { lt: new Date() },
        },
      }),
      prisma.activity.count({
        where: { ...branchFilter, date: { gte: startOfMonth } },
      }),
      prisma.lead.count({
        where: { ...branchFilter, dateAdded: { gte: startOfMonth } },
      }),
      prisma.project.groupBy({
        by: ["status"],
        where: branchFilter,
        _count: true,
        orderBy: { _count: { status: "desc" } },
      }),
    ]);

    return NextResponse.json({
      totalCompanies,
      totalContacts,
      totalLeads,
      totalProjects,
      activeLeads,
      activeProjects,
      upcomingFollowUps,
      overdueFollowUps,
      activitiesThisMonth,
      newLeadsThisMonth,
      projectsByStatus: projectsByStatus.map((p) => ({
        status: p.status,
        count: p._count,
      })),
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}