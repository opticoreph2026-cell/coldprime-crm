import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { addDaysISO, currentWeekRange, mondayOf, startOfDayPH, todayPH } from "@/lib/dates";

export async function GET() {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    // Manila calendar boundaries (never mutate a shared Date - lib/dates helpers).
    const today = todayPH();
    const startOfToday = startOfDayPH(today);
    const startOfTomorrow = startOfDayPH(addDaysISO(today, 1));
    const startOfMonth = startOfDayPH(`${today.slice(0, 7)}-01`);
    const weekStart = startOfDayPH(currentWeekRange().from);
    const nextWeekStart = startOfDayPH(addDaysISO(mondayOf(today), 7));

    const [
      totalCompanies,
      totalContacts,
      totalLeads,
      totalProjects,
      activeLeads,
      activeProjects,
      upcomingFollowUps,
      overdueFollowUps,
      followUpsDueToday,
      activitiesThisMonth,
      activitiesThisWeek,
      newLeadsThisMonth,
      newLeadsThisWeek,
      projectsByStatus,
      pipelineByStatus,
      accreditationsPending,
      totalActivities,
      totalVendors,
      totalEmailTemplates,
      recentActivities,
    ] = await Promise.all([
      prisma.company.count({ where: branchFilter }),
      prisma.contact.count({ where: branchFilter }),
      prisma.lead.count({ where: branchFilter }),
      prisma.project.count({ where: branchFilter }),
      prisma.lead.count({ where: { ...branchFilter, status: { notIn: ["Won", "Lost"] } } }),
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
        where: {
          ...branchFilter,
          nextFollowUp: { gte: startOfToday, lt: startOfTomorrow },
        },
      }),
      prisma.activity.count({
        where: { ...branchFilter, date: { gte: startOfMonth } },
      }),
      prisma.activity.count({
        where: { ...branchFilter, date: { gte: weekStart, lt: nextWeekStart } },
      }),
      prisma.lead.count({
        where: { ...branchFilter, dateAdded: { gte: startOfMonth } },
      }),
      prisma.lead.count({
        where: { ...branchFilter, dateAdded: { gte: weekStart, lt: nextWeekStart } },
      }),
      prisma.project.groupBy({
        by: ["status"],
        where: branchFilter,
        _count: true,
        orderBy: { _count: { status: "desc" } },
      }),
      prisma.lead.groupBy({
        by: ["status"],
        where: { ...branchFilter, status: { notIn: ["Won", "Lost"] } },
        _count: true,
        _sum: { estimatedValue: true },
      }),
      prisma.company.count({
        where: { ...branchFilter, accreditationStatus: { in: ["DOCUMENTS_SUBMITTED", "UNDER_REVIEW"] } },
      }),
      prisma.activity.count({ where: branchFilter }),
      prisma.vendor.count({ where: branchFilter }),
      prisma.emailTemplate.count({ where: branchFilter }),
      prisma.activity.findMany({
        where: branchFilter,
        orderBy: { date: "desc" },
        take: 6,
        select: {
          id: true, type: true, date: true, time: true, description: true,
          nextFollowUp: true,
          company: { select: { id: true, name: true } },
          project: { select: { id: true, projectName: true } },
        },
      }),
    ]);

    const pipelineTotal = pipelineByStatus.reduce((sum, p) => sum + Number(p._sum.estimatedValue || 0), 0);

    return NextResponse.json({
      totalCompanies,
      totalContacts,
      totalLeads,
      totalProjects,
      activeLeads,
      activeProjects,
      upcomingFollowUps,
      overdueFollowUps,
      followUpsDueToday,
      activitiesThisMonth,
      activitiesThisWeek,
      newLeadsThisMonth,
      newLeadsThisWeek,
      accreditationsPending,
      totalActivities,
      totalVendors,
      totalEmailTemplates,
      pipelineTotal,
      pipelineByStatus: pipelineByStatus
        .map((p) => ({ status: p.status, count: p._count, value: Number(p._sum.estimatedValue || 0) }))
        .sort((a, b) => b.value - a.value),
      recentActivities,
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