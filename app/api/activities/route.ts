import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "../prisma/client/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "";
    const companyId = searchParams.get("companyId") || "";
    const projectId = searchParams.get("projectId") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const upcoming = searchParams.get("upcoming") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const where: Prisma.ActivityWhereInput = {};

    if (search) {
      where.OR = [
        { contactPerson: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { notes: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { company: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } },
      ];
    }
    if (type) where.type = type;
    if (companyId) where.companyId = companyId;
    if (projectId) where.projectId = projectId;

    if (upcoming) {
      where.nextFollowUp = { gte: new Date() };
    }

    if (from || to) {
      where.date = {};
      if (from) (where.date as Prisma.DateTimeFilter).gte = new Date(from);
      if (to) (where.date as Prisma.DateTimeFilter).lte = new Date(to);
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        include: {
          company: { select: { id: true, name: true } },
          project: { select: { id: true, projectName: true } },
        },
        orderBy: { date: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.activity.count({ where }),
    ]);

    return NextResponse.json({
      data: activities,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      companyId, projectId, contactId, type, date, time,
      performedBy, contactPerson, description, result,
      nextAction, nextFollowUp, notes,
    } = body;

    if (!type) {
      return NextResponse.json({ error: "Activity type is required" }, { status: 400 });
    }

    const activity = await prisma.activity.create({
      data: {
        companyId: companyId || null,
        projectId: projectId || null,
        contactId: contactId || null,
        type,
        date: date ? new Date(date) : new Date(),
        time: time?.trim() || null,
        performedBy: performedBy?.trim() || null,
        contactPerson: contactPerson?.trim() || null,
        description: description?.trim() || null,
        result: result?.trim() || null,
        nextAction: nextAction?.trim() || null,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : null,
        notes: notes?.trim() || null,
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error("Error creating activity:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}