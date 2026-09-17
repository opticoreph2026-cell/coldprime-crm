import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));

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
      prisma.company.count(),
      prisma.contact.count(),
      prisma.lead.count(),
      prisma.project.count(),
      prisma.lead.count({ where: { status: { notIn: ["Completed", "Cancelled", "Declined"] } } }),
      prisma.project.count({ where: { status: { notIn: ["Completed", "Cancelled"] } } }),
      prisma.activity.count({
        where: {
          nextFollowUp: { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.activity.count({
        where: {
          nextFollowUp: { lt: new Date() },
        },
      }),
      prisma.activity.count({
        where: { date: { gte: startOfMonth } },
      }),
      prisma.lead.count({
        where: { dateAdded: { gte: startOfMonth } },
      }),
      prisma.project.groupBy({
        by: ["status"],
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