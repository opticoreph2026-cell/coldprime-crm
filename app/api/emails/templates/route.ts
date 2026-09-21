import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const branchFilter = await getBranchFilter();
    const templates = await prisma.emailTemplate.findMany({
      where: { ...branchFilter, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: templates });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "No branch assigned") return NextResponse.json({ error: "No branch assigned" }, { status: 400 });
    console.error("Error fetching templates:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const branchFilter = await getBranchFilter();
    const body = await request.json();
    const { name, subject, body: bodyContent, category } = body;

    if (!name || !subject || !bodyContent) {
      return NextResponse.json({ error: "Name, subject, and body are required" }, { status: 400 });
    }

    const template = await prisma.emailTemplate.create({
      data: {
        branchId: branchFilter.branchId,
        name,
        subject,
        body: bodyContent,
        category,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "No branch assigned") return NextResponse.json({ error: "No branch assigned" }, { status: 400 });
    console.error("Error creating template:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
