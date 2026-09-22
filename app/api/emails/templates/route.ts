import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth, requireBranchId } from "@/lib/branch";

export async function GET() {
  try {
    let session;
    try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const templates = await prisma.emailTemplate.findMany({
      where: { ...branchFilter, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: templates });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "No branch assigned") return NextResponse.json({ error: "No branch assigned" }, { status: 400 });
    console.error("Error fetching templates:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let session;
    try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    let branchId: string;
    try {
      branchId = await requireBranchId();
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "No branch assigned";
      return NextResponse.json(
        { error: `${m} — use the Active Branch selector in the sidebar, then save again.` },
        { status: 400 }
      );
    }
    const body = await request.json();
    const { name, subject, body: bodyContent, category } = body;

    if (!name || !subject || !bodyContent) {
      return NextResponse.json({ error: "Name, subject, and body are required" }, { status: 400 });
    }

    const template = await prisma.emailTemplate.create({
      data: {
        branchId,
        name,
        subject,
        body: bodyContent,
        category,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to save template";
    console.error("Error creating template:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
